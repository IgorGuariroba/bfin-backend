import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
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
    return insightsService.getTotais(parsed.userId, parsed.month);
  });

  app.get("/insights/saldos", async (request, reply) => {
    const parsed = parseQuery(request, reply);
    if (!parsed) return;
    return insightsService.getSaldos(parsed.userId, parsed.month);
  });

  app.get("/insights/month-summary", async (request, reply) => {
    const parsed = parseQuery(request, reply);
    if (!parsed) return;
    return insightsService.getMonthSummary(parsed.userId, parsed.month);
  });

  app.get("/insights/sugestoes", async (request, reply) => {
    const parsed = parseQuery(request, reply);
    if (!parsed) return;
    return insightsService.getSugestoes(parsed.userId, parsed.month);
  });
}
