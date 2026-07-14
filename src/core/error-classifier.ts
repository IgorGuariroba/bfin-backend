import { BillingValidationError } from "./billing/index.js";
import {
  TransactionNotFoundError,
  TransactionValidationError,
} from "./transactions/index.js";
import {
  SystemTagImmutableError,
  TagNotFoundError,
  TagValidationError,
} from "./tags/index.js";
import {
  PrevisaoNotFoundError,
  PrevisaoValidationError,
} from "./previsao/index.js";
import {
  InviteForbiddenError,
  InviteNotFoundError,
  InviteValidationError,
  ProRequiredError,
} from "./identity/index.js";
import { ApiKeyNotFoundError } from "./apikeys/index.js";
import { InsightsValidationError } from "./insights/index.js";

type ErrorKind = "validation" | "notFound" | "forbidden";

export type ErrorClassification = {
  kind: ErrorKind;
  meta?: { upgrade?: true };
};

/**
 * Classificador único de erros de domínio: recebe um erro e devolve a espécie
 * (validation/notFound/forbidden) mais metadados mínimos de renderização, ou
 * null se o erro não é de domínio conhecido. Vive adjacente ao core — conhece
 * as classes de erro dos 7 domínios, mas nenhuma noção de transporte. HTTP e
 * MCP consomem este único ponto e cada um renderiza a espécie a seu modo.
 *
 * NotFound/Forbidden são checados antes de Validation: TransactionNotFoundError
 * é subclasse de TransactionValidationError e precisa da espécie mais
 * específica. *UserNotFoundError (billing, identity) são deliberadamente
 * ausentes — permanecem não-classificados (500 no HTTP, propagam no MCP).
 */
export function classifyDomainError(
  error: unknown,
): ErrorClassification | null {
  if (!(error instanceof Error)) return null;

  if (error instanceof TransactionNotFoundError) return { kind: "notFound" };
  if (error instanceof TransactionValidationError)
    return { kind: "validation" };
  if (error instanceof TagNotFoundError) return { kind: "notFound" };
  if (error instanceof SystemTagImmutableError) return { kind: "forbidden" };
  if (error instanceof TagValidationError) return { kind: "validation" };
  if (error instanceof PrevisaoNotFoundError) return { kind: "notFound" };
  if (error instanceof PrevisaoValidationError) return { kind: "validation" };
  if (error instanceof InviteNotFoundError) return { kind: "notFound" };
  if (error instanceof InviteForbiddenError) return { kind: "forbidden" };
  if (error instanceof InviteValidationError) return { kind: "validation" };
  if (error instanceof InsightsValidationError) return { kind: "validation" };
  if (error instanceof ApiKeyNotFoundError) return { kind: "notFound" };
  if (error instanceof BillingValidationError) return { kind: "validation" };
  if (error instanceof ProRequiredError)
    return { kind: "forbidden", meta: { upgrade: true } };

  return null;
}
