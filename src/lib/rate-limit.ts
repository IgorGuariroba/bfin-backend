export interface RateLimitConfig {
  /** Máximo de chamadas permitidas dentro da janela. */
  limit: number;
  /** Tamanho da janela em milissegundos. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos até a janela reabrir; 0 quando a chamada foi permitida. */
  retryAfter: number;
}

interface Bucket {
  count: number;
  /** Instante (ms) em que a janela atual expira. */
  resetAt: number;
}

/**
 * Limites in-memory por ApiKey, separados por tipo de operação (ADR-0004).
 * Escrita é mais arriscada (um LLM em loop corrompe o livro financeiro) → cota
 * menor que leitura. Janela fixa de 60s.
 */
export const RATE_LIMITS = {
  read: { limit: 120, windowMs: 60_000 },
  write: { limit: 30, windowMs: 60_000 },
} as const;

export type RateLimitKind = keyof typeof RATE_LIMITS;

/** Tools que alteram dados — contam contra a cota de escrita. As demais são leitura. */
const WRITE_TOOLS = new Set([
  "create_transaction",
  "update_transaction",
  "delete_transaction",
  "create_tag",
]);

/**
 * Classifica uma chamada JSON-RPC do MCP como `write` ou `read` para escolher a
 * cota. Só `tools/call` de uma WRITE_TOOLS é escrita; `tools/list`, `initialize`
 * e leituras (`get_*`/`list_*`) são leitura. Body inválido cai em `read` (o
 * transport lida com o erro de protocolo depois).
 *
 * Trata batch JSON-RPC (array): se qualquer chamada do lote for escrita, o lote
 * inteiro conta como escrita — caso contrário um lote com `tools/call` de write
 * burlaria a cota mais restrita usando a de leitura.
 */
export function classifyRpc(rawBody: string): RateLimitKind {
  try {
    const msg = JSON.parse(rawBody);
    const calls = Array.isArray(msg) ? msg : [msg];
    for (const call of calls) {
      if (
        call?.method === "tools/call" &&
        WRITE_TOOLS.has(call?.params?.name)
      ) {
        return "write";
      }
    }
  } catch {
    // body não-JSON: trata como leitura (não onera a cota de escrita).
  }
  return "read";
}

const buckets = new Map<string, Bucket>();

/**
 * Acima deste número de baldes vivos, fazemos uma varredura preguiçosa removendo
 * os já expirados. Sem isso o Map cresce indefinidamente (cada `apiKeyId:kind`
 * distinto fica para sempre, mesmo após a janela fechar) — memory leak lento em
 * produção. A limpeza só roda ao abrir uma janela nova, não no caminho quente.
 */
const MAX_BUCKETS = 1000;

function evictExpired(now: number): void {
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

/**
 * Rate limit in-memory por chave, janela fixa (ADR-0004). Cada chave
 * (`apiKeyId:kind`) tem seu balde: a primeira chamada abre a janela, e ao
 * exceder `limit` antes de `windowMs` retorna `allowed: false` com `retryAfter`.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size > MAX_BUCKETS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= config.limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count++;
  return { allowed: true, retryAfter: 0 };
}
