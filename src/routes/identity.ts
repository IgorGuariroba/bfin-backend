import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ProRequiredError } from "../core/identity/index.js";
import { identityService } from "../adapters/index.js";

/** Compara em tempo constante; length-mismatch → false (timingSafeEqual exige buffers do mesmo tamanho). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function requireInternalSecret(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
) {
  const secret = process.env.INTERNAL_API_SECRET;
  const provided = request.headers["x-internal-secret"];
  if (!secret || typeof provided !== "string" || !safeEqual(provided, secret)) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  done();
}

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
    try {
      await identityService.setAutoBaixaDiario(userId, enabled);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof ProRequiredError) {
        return reply.code(403).send({ error: error.message });
      }
      throw error;
    }
  });
}
