import type { FastifyReply, FastifyRequest } from "fastify";
import { classifyDomainError } from "../core/error-classifier.js";

const STATUS_BY_KIND = {
  validation: 400,
  notFound: 404,
  forbidden: 403,
} as const;

/**
 * Renderização HTTP edge-owned do classificador único de erros de domínio
 * (src/core/error-classifier.ts): espécie → status. Substitui o mapa de 14
 * classes que antes vivia aqui — a taxonomia agora é responsabilidade do
 * classificador, este módulo só traduz espécie para status/corpo HTTP.
 *
 * Erros não classificados (ex.: *UserNotFoundError) seguem como 500
 * (comportamento anterior preservado).
 */
export function domainErrorReply(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} | null {
  const classification = classifyDomainError(error);
  if (!classification) return null;

  const body: Record<string, unknown> = {
    error: (error as Error).message,
  };
  if (classification.meta?.upgrade) body.upgrade = true;
  return { status: STATUS_BY_KIND[classification.kind], body };
}

/**
 * Handler Fastify para registrar via app.setErrorHandler. Mapeia erros de
 * domínio; o resto delega ao comportamento padrão (500 + serializer do Fastify),
 * preservando o que o `throw` das rotas já produzia.
 */
export function domainErrorHandler(
  error: Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const mapped = domainErrorReply(error);
  if (mapped) {
    reply.code(mapped.status).send(mapped.body);
    return;
  }
  reply.send(error);
}
