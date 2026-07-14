import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalSecret } from "./internal-api.js";
import { insightsService } from "../adapters/index.js";
import { parseOr400, requiredString } from "./parse.js";

const insightsQuerySchema = z.object({
  userId: requiredString,
  month: requiredString,
});

export function insightsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/insights/totais", async (request, reply) => {
    const query = parseOr400(insightsQuerySchema, request.query, reply);
    if (!query) return;
    return insightsService.getTotais(query.userId, query.month);
  });

  app.get("/insights/saldos", async (request, reply) => {
    const query = parseOr400(insightsQuerySchema, request.query, reply);
    if (!query) return;
    return insightsService.getSaldos(query.userId, query.month);
  });

  app.get("/insights/month-summary", async (request, reply) => {
    const query = parseOr400(insightsQuerySchema, request.query, reply);
    if (!query) return;
    return insightsService.getMonthSummary(query.userId, query.month);
  });

  app.get("/insights/sugestoes", async (request, reply) => {
    const query = parseOr400(insightsQuerySchema, request.query, reply);
    if (!query) return;
    return insightsService.getSugestoes(query.userId, query.month);
  });
}
