import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  TransactionNotFoundError,
  TransactionValidationError,
} from "../core/transactions/index.js";
import { suggestTag, suggestType } from "../core/transactions/suggest.js";
import { tagsService, transactionsService } from "../adapters/index.js";

/** Compara em tempo constante; length-mismatch → false (timingSafeEqual exige buffers do mesmo tamanho). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function requireInternalSecret(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const secret = process.env.INTERNAL_API_SECRET;
  const provided = request.headers["x-internal-secret"];
  if (!secret || typeof provided !== "string" || !safeEqual(provided, secret)) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  done();
}

// Mapeia erros de domínio do core para HTTP; retorna true se tratou.
function domainErrorResponse(error: unknown, reply: FastifyReply): boolean {
  if (error instanceof TransactionNotFoundError) {
    reply.code(404).send({ error: error.message });
    return true;
  }
  if (error instanceof TransactionValidationError) {
    reply.code(400).send({ error: error.message });
    return true;
  }
  return false;
}

export function transactionsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/transactions", async (request, reply) => {
    const { userId, month, type, tagId, from, to } = request.query as Record<string, string | undefined>;
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      return await transactionsService.listTransactions(userId, { month, type, tagId, from, to });
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.post("/transactions/suggest", async (request, reply) => {
    const { userId, description, type } = request.body as {
      userId?: string;
      description?: string;
      type?: string;
    };
    if (!userId || !description) {
      return reply.code(400).send({ error: "userId e description são obrigatórios" });
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
    if (!body.userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
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
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
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
    if (!body.userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      return await transactionsService.updateTransaction({
        userId: body.userId,
        id,
        type: body.type,
        description: body.description,
        amount: body.amount,
        date: body.date,
        tagIds: body.tagIds,
      });
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.delete("/transactions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      await transactionsService.deleteTransaction(userId, id);
      return reply.code(204).send();
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });
}
