/**
 * Cliente server-side do Google Ads API (ADR-0010).
 *
 * Único propósito: fazer upload de uma **conversão de clique** (assinatura
 * paga confirmada) para a conta de anúncios do bfin, atribuída ao identificador
 * (gclid/gbraid/wbraid) que originou o clique do anúncio. Disparado pelo webhook
 * do MercadoPago quando
 * o plano vira `pro` pela primeira vez — nunca no retorno do checkout.
 *
 * Sem SDK do Google Ads (seria +1 dependência pesada): usa `fetch` direto na
 * REST API v22 + troca do refresh_token por access_token (OAuth Desktop).
 */

const API_VERSION = "v22";
const ADS_BASE = "https://googleads.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Brasil abolilou DST em 2019 → offset fixo America/Sao_Paulo (-03:00). */
const SAO_PAULO_OFFSET = "-03:00";

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`google-ads: env ${key} não configurada`);
  return v;
}

/**
 * true apenas quando todas as env vars do Google Ads estão presentes.
 * Usado como feature flag pelo webhook — se falso, o rastreio fica desligado
 * (nenhuma chamada à API, nenhum erro).
 */
export function isGoogleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID &&
    process.env.GOOGLE_ADS_CUSTOMER_ID &&
    process.env.GOOGLE_ADS_CONVERSION_ACTION_ID,
  );
}

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("GOOGLE_ADS_CLIENT_ID"),
      client_secret: required("GOOGLE_ADS_CLIENT_SECRET"),
      refresh_token: required("GOOGLE_ADS_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `token refresh falhou (${res.status}): ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Formata uma Date como "YYYY-MM-DD HH:MM:SS-03:00" (fuso São Paulo). */
function formatAdsDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}${SAO_PAULO_OFFSET}`;
}

/**
 * Identificador do clique no anúncio. O Google emite `gclid` no caso geral, mas
 * usa `gbraid`/`wbraid` quando o `gclid` não está disponível (tráfego iOS/app,
 * privacidade). A API de conversão tem um campo próprio para cada — daí o
 * discriminador `type`, que é exatamente o nome do campo enviado.
 */
type ClickIdType = "gclid" | "gbraid" | "wbraid";

export interface ClickId {
  type: ClickIdType;
  value: string;
}

/**
 * Resolve o identificador de clique a partir dos campos persistidos no User,
 * preferindo `gclid` (recomendação do Google) e caindo para gbraid/wbraid.
 * Retorna null quando o User não carrega nenhum — não é atribuível.
 */
export function resolveClickId(source: {
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
}): ClickId | null {
  if (source.gclid) return { type: "gclid", value: source.gclid };
  if (source.gbraid) return { type: "gbraid", value: source.gbraid };
  if (source.wbraid) return { type: "wbraid", value: source.wbraid };
  return null;
}

export interface ConversionInput {
  /** Identificador do clique capturado na landing e persistido no cadastro. */
  clickId: ClickId;
  /** Momento do evento (pagamento confirmado, ou cadastro). */
  occurredAt: Date;
  /**
   * Valor da assinatura em BRL. Reporta o **primeiro pagamento** (mensal
   * 14,90 / anual 119,90), não o LTV — honesto e sem inventar número, mas
   * subvaloriza o mensal e enviesa a comparação mensal-vs-anual (ADR-0010,
   * atualização 2026-07-01). Omitir em conversões secundárias sem valor,
   * como o Sinal de cadastro.
   */
  value?: number;
  /**
   * ID da conversion action. Default = ação primária (Conversão paga,
   * GOOGLE_ADS_CONVERSION_ACTION_ID). Passar explicitamente para o Sinal
   * de cadastro (secundário).
   */
  conversionActionId?: string;
}

export type ConversionResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "error"; error?: string };

/**
 * Faz upload de uma conversão de clique para a conta de anúncios.
 * Idempotente apenas do lado de quem chama (o webhook marca
 * `conversionReportedAt`); a API em si aceita reenvios do mesmo gclid
 * num curto intervalo (dedup nativa por gclid+action+datetime).
 */
export async function uploadConversion(
  conv: ConversionInput,
): Promise<ConversionResult> {
  if (!isGoogleAdsConfigured()) {
    return { ok: false, reason: "not-configured" };
  }

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
  const actionId =
    conv.conversionActionId ?? process.env.GOOGLE_ADS_CONVERSION_ACTION_ID!;
  const conversionAction = `customers/${customerId}/conversionActions/${actionId}`;

  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `${ADS_BASE}/api/${API_VERSION}/customers/${customerId}:uploadClickConversions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": required("GOOGLE_ADS_DEVELOPER_TOKEN"),
          "login-customer-id": process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
          partial_failure: true,
          validate_only: false,
          conversions: [
            {
              [conv.clickId.type]: conv.clickId.value,
              conversion_action: conversionAction,
              conversion_date_time: formatAdsDateTime(conv.occurredAt),
              // Valor só na conversão paga; o Sinal de cadastro vai sem valor.
              ...(conv.value !== undefined
                ? { conversion_value: conv.value, currency_code: "BRL" }
                : {}),
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      return {
        ok: false,
        reason: "error",
        error: `upload falhou (${res.status}): ${await res.text()}`,
      };
    }

    const data = (await res.json()) as { partialFailureError?: unknown };
    if (data.partialFailureError) {
      return {
        ok: false,
        reason: "error",
        error: `partial_failure: ${JSON.stringify(data.partialFailureError)}`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
