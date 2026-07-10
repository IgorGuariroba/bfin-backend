import type { FastifyReply, FastifyRequest } from "fastify";
import { BillingValidationError } from "../core/billing/index.js";
import {
  TransactionNotFoundError,
  TransactionValidationError,
} from "../core/transactions/index.js";
import {
  SystemTagImmutableError,
  TagNotFoundError,
  TagValidationError,
} from "../core/tags/index.js";
import {
  PrevisaoNotFoundError,
  PrevisaoValidationError,
} from "../core/previsao/index.js";
import {
  InviteForbiddenError,
  InviteNotFoundError,
  InviteValidationError,
  ProRequiredError,
} from "../core/identity/index.js";
import { ApiKeyNotFoundError } from "../core/apikeys/index.js";
import { InsightsValidationError } from "../core/insights/index.js";

/**
 * Mapa edge-owned de erro de domínio → resposta HTTP. Concentra o que antes
 * vivia copiado nos domainErrorResponse de cada rota (e inline em insights/
 * apikeys/identity). É a única fonte de mapeamento — o core permanece agnóstico
 * de HTTP (ADR-0013).
 *
 * NotFound/Forbidden/Immutable são checados antes de Validation:
 * TransactionNotFoundError é subclasse de TransactionValidationError e precisa
 * do 404 específico. *UserNotFoundError são deliberadamente ausentes — seguem
 * como 500 (comportamento anterior).
 */
export function domainErrorReply(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} | null {
  if (!(error instanceof Error)) return null;

  const status =
    error instanceof TransactionNotFoundError
      ? 404
      : error instanceof TransactionValidationError
        ? 400
        : error instanceof TagNotFoundError
          ? 404
          : error instanceof SystemTagImmutableError
            ? 403
            : error instanceof TagValidationError
              ? 400
              : error instanceof PrevisaoNotFoundError
                ? 404
                : error instanceof PrevisaoValidationError
                  ? 400
                  : error instanceof InviteNotFoundError
                    ? 404
                    : error instanceof InviteForbiddenError
                      ? 403
                      : error instanceof InviteValidationError
                        ? 400
                        : error instanceof InsightsValidationError
                          ? 400
                          : error instanceof ApiKeyNotFoundError
                            ? 404
                            : error instanceof BillingValidationError
                              ? 400
                              : error instanceof ProRequiredError
                                ? 403
                                : null;

  if (status === null) return null;

  const body: Record<string, unknown> = { error: error.message };
  if (error instanceof ProRequiredError) body.upgrade = true;
  return { status, body };
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
