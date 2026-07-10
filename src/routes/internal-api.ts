import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

/** Compara em tempo constante; length-mismatch → false (timingSafeEqual exige buffers do mesmo tamanho). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Guarda de auth interna compartilhada. As rotas internas (atrás de
 * INTERNAL_API_SECRET) registram este hook no onRequest — antes cada uma
 * carregava sua própria cópia de safeEqual + requireInternalSecret. MCP (bearer)
 * e webhook do MercadoPago (HMAC) têm auth própria e não usam isto.
 */
export function requireInternalSecret(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
) {
  const secret = process.env.INTERNAL_API_SECRET;
  const provided = request.headers["x-internal-secret"];
  if (!secret || typeof provided !== "string" || !safeEqual(provided, secret)) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  done();
}
