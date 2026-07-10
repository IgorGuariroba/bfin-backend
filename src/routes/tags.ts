import type { FastifyInstance, FastifyReply } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import {
  TagNotFoundError,
  SystemTagImmutableError,
  TagValidationError,
} from "../core/tags/index.js";
import { tagsService } from "../adapters/index.js";

// Mapeia erros de domínio do core para HTTP; retorna null se o erro não é de domínio.
function domainErrorResponse(error: unknown, reply: FastifyReply): boolean {
  if (error instanceof TagNotFoundError) {
    reply.code(404).send({ error: error.message });
    return true;
  }
  if (error instanceof SystemTagImmutableError) {
    reply.code(403).send({ error: error.message });
    return true;
  }
  if (error instanceof TagValidationError) {
    reply.code(400).send({ error: error.message });
    return true;
  }
  return false;
}

export function tagsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/tags", async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    return tagsService.listTags(userId);
  });

  app.post("/tags/ensure-system", async (request, reply) => {
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    await tagsService.ensureSystemTags(userId);
    return reply.code(204).send();
  });

  app.post("/tags", async (request, reply) => {
    const { userId, name, color } = request.body as {
      userId?: string;
      name?: string;
      color?: string;
    };
    if (!userId || !name)
      return reply.code(400).send({ error: "userId e name são obrigatórios" });
    try {
      const tag = await tagsService.createTag({ userId, name, color });
      return reply.code(201).send(tag);
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.put("/tags/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId, name, color } = request.body as {
      userId?: string;
      name?: string;
      color?: string;
    };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      return await tagsService.updateTag(userId, id, { name, color });
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.delete("/tags/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      await tagsService.deleteTag(userId, id);
      return { success: true };
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });
}
