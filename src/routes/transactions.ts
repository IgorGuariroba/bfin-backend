import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalSecret } from "./internal-api.js";
import { transactionsService } from "../adapters/index.js";
import { parseOr400, requiredString } from "./parse.js";

const listQuerySchema = z.object({
  userId: requiredString,
  month: z.string().optional(),
  type: z.string().optional(),
  tagId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const suggestBodySchema = z.object({
  userId: requiredString,
  description: requiredString,
  type: z.string().optional(),
});

const createBodySchema = z.object({
  userId: requiredString,
  type: z.string().default(""),
  description: z.string().default(""),
  amount: z.number(),
  date: z.string(),
  source: z.enum(["manual", "agent"]).optional(),
  repeat: z.string().optional(),
  repeatEnd: z.string().optional(),
  repeatCount: z.number().optional(),
  tagIds: z.array(z.string()).optional(),
  force: z.boolean().optional(),
});

const updateBodySchema = z.object({
  userId: requiredString,
  type: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().optional(),
  date: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

const idParamsSchema = z.object({ id: z.string() });

const userIdBodySchema = z.object({ userId: requiredString });

export function transactionsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/transactions", async (request, reply) => {
    const query = parseOr400(listQuerySchema, request.query, reply);
    if (!query) return;
    const { userId, ...filters } = query;
    return transactionsService.listTransactions(userId, filters);
  });

  app.post("/transactions/suggest", async (request, reply) => {
    const body = parseOr400(suggestBodySchema, request.body, reply);
    if (!body) return;
    return transactionsService.suggest(body);
  });

  app.post("/transactions", async (request, reply) => {
    const body = parseOr400(createBodySchema, request.body, reply);
    if (!body) return;
    const result = await transactionsService.createTransaction(body);
    return reply.code(201).send(result);
  });

  app.put("/transactions/:id", async (request, reply) => {
    const params = parseOr400(idParamsSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateBodySchema, request.body, reply);
    if (!body) return;
    return transactionsService.updateTransaction({ ...body, id: params.id });
  });

  app.delete("/transactions/:id", async (request, reply) => {
    const params = parseOr400(idParamsSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(userIdBodySchema, request.body, reply);
    if (!body) return;
    await transactionsService.deleteTransaction(body.userId, params.id);
    return reply.code(204).send();
  });
}
