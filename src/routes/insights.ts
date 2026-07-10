import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import { InsightsValidationError } from "../core/insights/index.js";
import { insightsService } from "../adapters/index.js";

function parseQuery(
  request: FastifyRequest,
  reply: FastifyReply,
): { userId: string; month: string } | null {
  const { userId, month } = request.query as {
    userId?: string;
    month?: string;
  };
  if (!userId || !month) {
    reply.code(400).send({ error: "userId e month são obrigatórios" });
    return null;
  }
  return { userId, month };
}

export function insightsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/insights/totais", async (request, reply) => {
    const parsed = parseQuery(request, reply);
    if (!parsed) return;
    try {
      return await insightsService.getTotais(parsed.userId, parsed.month);
    } catch (error) {
      if (error instanceof InsightsValidationError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });

  app.get("/insights/saldos", async (request, reply) => {
    const parsed = parseQuery(request, reply);
    if (!parsed) return;
    try {
      return await insightsService.getSaldos(parsed.userId, parsed.month);
    } catch (error) {
      if (error instanceof InsightsValidationError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });

  app.get("/insights/month-summary", async (request, reply) => {
    const parsed = parseQuery(request, reply);
    if (!parsed) return;
    try {
      return await insightsService.getMonthSummary(parsed.userId, parsed.month);
    } catch (error) {
      if (error instanceof InsightsValidationError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });

  app.get("/insights/sugestoes", async (request, reply) => {
    const parsed = parseQuery(request, reply);
    if (!parsed) return;
    try {
      return await insightsService.getSugestoes(parsed.userId, parsed.month);
    } catch (error) {
      if (error instanceof InsightsValidationError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });
}
