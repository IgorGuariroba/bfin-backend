import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalSecret } from "./internal-api.js";
import { previsaoService } from "../adapters/index.js";
import { parseOr400, requiredString } from "./parse.js";

const userIdQuerySchema = z.object({ userId: requiredString });

const createBodySchema = z.object({
  userId: requiredString,
  name: z.string().default(""),
  amount: z.number(),
});

const updateBodySchema = z.object({
  userId: requiredString,
  name: z.string().optional(),
  amount: z.number().optional(),
});

const aplicarBodySchema = z.object({
  userId: requiredString,
  amount: z.number(),
});

const idParamsSchema = z.object({ id: z.string() });

const userIdBodySchema = z.object({ userId: requiredString });

export function previsaoRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/previsao", async (request, reply) => {
    const query = parseOr400(userIdQuerySchema, request.query, reply);
    if (!query) return;
    return previsaoService.listPrevisoes(query.userId);
  });

  app.post("/previsao", async (request, reply) => {
    const body = parseOr400(createBodySchema, request.body, reply);
    if (!body) return;
    const previsao = await previsaoService.createPrevisao(body);
    return reply.code(201).send(previsao);
  });

  app.put("/previsao/:id", async (request, reply) => {
    const params = parseOr400(idParamsSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateBodySchema, request.body, reply);
    if (!body) return;
    return previsaoService.updatePrevisao({ ...body, id: params.id });
  });

  app.delete("/previsao/:id", async (request, reply) => {
    const params = parseOr400(idParamsSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(userIdBodySchema, request.body, reply);
    if (!body) return;
    await previsaoService.deletePrevisao(body.userId, params.id);
    return { success: true };
  });

  app.post("/previsao/aplicar", async (request, reply) => {
    const body = parseOr400(aplicarBodySchema, request.body, reply);
    if (!body) return;
    const { count } = await previsaoService.applyPrevisao(body);
    return { count };
  });

  // Baixa automática (ADR-0005): batch sem userId, roda pra todos os usuários
  // elegíveis. Chamada internamente pelo cron do bfin-app (que valida CRON_SECRET).
  app.post("/previsao/baixa-diaria", async () => {
    return previsaoService.baixaDiaria();
  });
}
