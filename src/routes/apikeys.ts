import type { FastifyInstance } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import { apiKeysService } from "../adapters/index.js";

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
    const issued = await apiKeysService.issueApiKey(userId);
    return reply.code(201).send(issued);
  });

  app.delete("/apikeys/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    await apiKeysService.revokeApiKey(userId, id);
    return { success: true };
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
