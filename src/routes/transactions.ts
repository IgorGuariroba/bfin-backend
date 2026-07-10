import type { FastifyInstance } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import { suggestTag, suggestType } from "../core/transactions/suggest.js";
import { tagsService, transactionsService } from "../adapters/index.js";

export function transactionsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/transactions", async (request, reply) => {
    const { userId, month, type, tagId, from, to } = request.query as Record<
      string,
      string | undefined
    >;
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    return transactionsService.listTransactions(userId, {
      month,
      type,
      tagId,
      from,
      to,
    });
  });

  app.post("/transactions/suggest", async (request, reply) => {
    const { userId, description, type } = request.body as {
      userId?: string;
      description?: string;
      type?: string;
    };
    if (!userId || !description) {
      return reply
        .code(400)
        .send({ error: "userId e description são obrigatórios" });
    }
    const resolvedType = type ?? suggestType(description);
    const userTags = await tagsService.listTags(userId);
    const tagId = suggestTag(description, userTags);
    return { type: resolvedType, tagId };
  });

  app.post("/transactions", async (request, reply) => {
    const body = request.body as {
      userId?: string;
      type?: string;
      description?: string;
      amount?: number;
      date?: string;
      source?: "manual" | "agent";
      repeat?: string;
      repeatEnd?: string;
      repeatCount?: number;
      tagIds?: string[];
      force?: boolean;
    };
    if (!body.userId)
      return reply.code(400).send({ error: "userId é obrigatório" });
    const result = await transactionsService.createTransaction({
      userId: body.userId,
      type: body.type ?? "",
      description: body.description ?? "",
      amount: body.amount as number,
      date: body.date as string,
      source: body.source,
      repeat: body.repeat,
      repeatEnd: body.repeatEnd,
      repeatCount: body.repeatCount,
      tagIds: body.tagIds,
      force: body.force,
    });
    return reply.code(201).send(result);
  });

  app.put("/transactions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      userId?: string;
      type?: string;
      description?: string;
      amount?: number;
      date?: string;
      tagIds?: string[];
    };
    if (!body.userId)
      return reply.code(400).send({ error: "userId é obrigatório" });
    return transactionsService.updateTransaction({
      userId: body.userId,
      id,
      type: body.type,
      description: body.description,
      amount: body.amount,
      date: body.date,
      tagIds: body.tagIds,
    });
  });

  app.delete("/transactions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    await transactionsService.deleteTransaction(userId, id);
    return reply.code(204).send();
  });
}
