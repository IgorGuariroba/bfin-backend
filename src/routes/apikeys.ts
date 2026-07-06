import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiKeyNotFoundError } from "../core/apikeys/index.js";
import { ProRequiredError } from "../core/identity/index.js";
import { apiKeysService } from "../adapters/index.js";

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

export function apikeysRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/apikeys", async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    return apiKeysService.listApiKeys(userId);
  });

  app.post("/apikeys", async (request, reply) => {
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      const issued = await apiKeysService.issueApiKey(userId);
      return reply.code(201).send(issued);
    } catch (error) {
      if (error instanceof ProRequiredError) {
        return reply.code(403).send({ error: error.message, upgrade: true });
      }
      throw error;
    }
  });

  app.delete("/apikeys/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      await apiKeysService.revokeApiKey(userId, id);
      return { success: true };
    } catch (error) {
      if (error instanceof ApiKeyNotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  app.post("/apikeys/resolve-principal", async (request, reply) => {
    const { token } = request.body as { token?: string };
    if (!token) return reply.code(400).send({ error: "token é obrigatório" });
    const principal = await apiKeysService.resolvePrincipal(token);
    return principal;
  });

  app.post("/apikeys/record-write", async (request, reply) => {
    const { apiKeyId, userId, action, entityId } = request.body as {
      apiKeyId?: string;
      userId?: string;
      action?: "create" | "update" | "delete";
      entityId?: string;
    };
    if (!apiKeyId || !userId || !action || !entityId) {
      return reply.code(400).send({
        error: "apiKeyId, userId, action e entityId são obrigatórios",
      });
    }
    await apiKeysService.recordAgentWrite({
      apiKeyId,
      userId,
      action,
      entityId,
    });
    return reply.code(204).send();
  });
}
