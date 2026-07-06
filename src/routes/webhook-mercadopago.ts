import type { FastifyInstance } from "fastify";
import { WebhookSignatureValidator } from "mercadopago";
import { billingService } from "../adapters/index.js";

/** Tolerância do ts da assinatura: além disso é replay de webhook capturado. */
const SIGNATURE_TOLERANCE_MS = 5 * 60_000;

function verifySignature(
  headers: { xSignature: string; xRequestId: string | null },
  dataId: string,
  secret: string
): boolean {
  const { xSignature, xRequestId } = headers;

  // Frescor: o ts é assinado, então um replay carrega o ts original. Feito
  // aqui (e não via toleranceSeconds do SDK) porque a doc do MP exemplifica ts
  // em segundos e o SDK assume ms — < 1e12 cobre segundos até ~2286.
  const ts = xSignature.match(/ts=([^,]+)/)?.[1];
  const tsNum = Number(ts);
  if (!ts || !Number.isFinite(tsNum)) return false;
  const tsMs = tsNum < 1e12 ? tsNum * 1000 : tsNum;
  if (Math.abs(Date.now() - tsMs) > SIGNATURE_TOLERANCE_MS) return false;

  // Assinatura: delegada ao validador oficial do SDK, que monta o manifesto
  // documentado (`id:<lowercase>;request-id:...;ts:...;`) e compara o HMAC em
  // tempo constante.
  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Canal público (Traefik roteia bfincont.com.br/api/webhook/mercadopago direto
 * pra cá — path idêntico ao público, mesma decisão da rota MCP). Autenticado
 * pela assinatura HMAC do MercadoPago, não pelo x-internal-secret.
 */
export function webhookMercadoPagoRoutes(app: FastifyInstance) {
  app.post("/api/webhook/mercadopago", async (request, reply) => {
    const { type, data } = (request.body ?? {}) as { type?: string; data?: { id?: string } };

    if (type !== "subscription_preapproval" || !data?.id) {
      console.log("mp-webhook: ignored", { type: type ?? null, hasDataId: Boolean(data?.id) });
      return { ok: true };
    }

    // Fail-closed: sem secret não há como verificar a origem — processar seria
    // aceitar webhook forjado ativando Pro de graça (mesmo padrão do CRON_SECRET).
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (!secret) {
      console.error("mp-webhook: secret not configured");
      return reply.code(500).send({ error: "MERCADO_PAGO_WEBHOOK_SECRET not configured" });
    }

    const xSignature = request.headers["x-signature"];
    const xRequestId = request.headers["x-request-id"];
    const verified = verifySignature(
      {
        xSignature: typeof xSignature === "string" ? xSignature : "",
        xRequestId: typeof xRequestId === "string" ? xRequestId : null,
      },
      data.id,
      secret
    );
    if (!verified) {
      console.warn("mp-webhook: invalid signature", { dataId: data.id });
      return reply.code(401).send({ error: "Invalid signature" });
    }

    // Verificada a origem, segue o processamento de domínio (mudança de plano).
    // Erro aqui é nosso (ou do MP upstream) — responde 500 uniforme pro MP
    // re-tentar, sem repassar o status da chamada interna à API deles.
    try {
      await billingService.processSubscriptionEvent(data.id);
    } catch (err) {
      console.error("mp-webhook: processing failed", { dataId: data.id, err });
      return reply.code(500).send({ error: "Failed to process event" });
    }

    console.log("mp-webhook: processed", { dataId: data.id });
    return { ok: true };
  });
}
