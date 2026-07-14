import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalSecret } from "./internal-api.js";
import { identityService } from "../adapters/index.js";
import { parseOr400, requiredString } from "./parse.js";

const resolveEffectiveUserBodySchema = z.object({
  sessionUserId: requiredString,
  requestedOwnerId: z.string().nullish(),
});

const userIdQuerySchema = z.object({ userId: requiredString });

const autoBaixaBodySchema = z.object({
  userId: requiredString,
  enabled: z.boolean(),
});

export function identityRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.post("/identity/resolve-effective-user", async (request, reply) => {
    const body = parseOr400(
      resolveEffectiveUserBodySchema,
      request.body,
      reply,
    );
    if (!body) return;
    return identityService.getDelegationInfo(
      body.sessionUserId,
      body.requestedOwnerId,
    );
  });

  app.get("/identity/plan", async (request, reply) => {
    const query = parseOr400(userIdQuerySchema, request.query, reply);
    if (!query) return;
    const plan = await identityService.getUserPlan(query.userId);
    return { plan };
  });

  app.post("/identity/auto-baixa-diario", async (request, reply) => {
    const body = parseOr400(autoBaixaBodySchema, request.body, reply);
    if (!body) return;
    await identityService.setAutoBaixaDiario(body.userId, body.enabled);
    return reply.code(204).send();
  });
}
