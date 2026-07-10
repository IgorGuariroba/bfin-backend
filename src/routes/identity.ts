import type { FastifyInstance } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import { identityService } from "../adapters/index.js";

export function identityRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.post("/identity/resolve-effective-user", async (request, reply) => {
    const { sessionUserId, requestedOwnerId } = request.body as {
      sessionUserId?: string;
      requestedOwnerId?: string | null;
    };
    if (!sessionUserId)
      return reply.code(400).send({ error: "sessionUserId é obrigatório" });
    return identityService.getDelegationInfo(sessionUserId, requestedOwnerId);
  });

  app.get("/identity/plan", async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    const plan = await identityService.getUserPlan(userId);
    return { plan };
  });

  app.post("/identity/auto-baixa-diario", async (request, reply) => {
    const { userId, enabled } = request.body as {
      userId?: string;
      enabled?: boolean;
    };
    if (!userId || typeof enabled !== "boolean") {
      return reply
        .code(400)
        .send({ error: "userId e enabled são obrigatórios" });
    }
    await identityService.setAutoBaixaDiario(userId, enabled);
    return reply.code(204).send();
  });
}
