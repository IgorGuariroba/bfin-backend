import type { FastifyReply } from "fastify";
import { z } from "zod";

/**
 * Camada de parsing edge-owned da fronteira REST (par do mapa de erros de
 * domínio): valida body/query/params com zod e concentra o 400 de entrada
 * inválida que antes vivia copiado como guarda em cada handler. O contrato de
 * erro é o de sempre — `{ error: string }`, status 400 — com a mensagem
 * derivada dos campos: ausentes (undefined/null/"") viram "é obrigatório",
 * presentes com tipo errado viram "é inválido".
 */

/** String obrigatória: rejeita ausente e vazia (equivale à guarda `!campo`). */
export const requiredString = z.string().min(1);

function fieldValue(data: unknown, path: PropertyKey[]): unknown {
  let current: unknown = data;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

/** "a" | "a e b" | "a, b e c" — o formato das mensagens que as rotas já usavam. */
function listFields(fields: string[]): string {
  if (fields.length === 1) return fields[0];
  return `${fields.slice(0, -1).join(", ")} e ${fields[fields.length - 1]}`;
}

function validationMessage(data: unknown, error: z.ZodError): string {
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (!field) return "requisição inválida";
    const value = fieldValue(data, issue.path);
    const bucket =
      value === undefined || value === null || value === "" ? missing : invalid;
    if (!bucket.includes(field)) bucket.push(field);
  }
  if (missing.length > 0) {
    return missing.length === 1
      ? `${missing[0]} é obrigatório`
      : `${listFields(missing)} são obrigatórios`;
  }
  return invalid.length === 1
    ? `${invalid[0]} é inválido`
    : `${listFields(invalid)} são inválidos`;
}

/**
 * Valida `data` contra o schema. Em sucesso devolve o valor tipado; em falha
 * envia o 400 uniforme e devolve null — o handler faz `if (!parsed) return`.
 * Body ausente (ex.: DELETE sem payload) é tratado como objeto vazio, virando
 * "campo é obrigatório" em vez do TypeError/500 do destructuring anterior.
 */
export function parseOr400<S extends z.ZodType>(
  schema: S,
  data: unknown,
  reply: FastifyReply,
): z.output<S> | null {
  const input = data ?? {};
  const result = schema.safeParse(input);
  if (!result.success) {
    reply.code(400).send({ error: validationMessage(input, result.error) });
    return null;
  }
  return result.data;
}
