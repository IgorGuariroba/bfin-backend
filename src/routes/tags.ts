import type { FastifyInstance } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import { tagsService } from "../adapters/index.js";

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
    const tag = await tagsService.createTag({ userId, name, color });
    return reply.code(201).send(tag);
  });

  app.put("/tags/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId, name, color } = request.body as {
      userId?: string;
      name?: string;
      color?: string;
    };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    return tagsService.updateTag(userId, id, { name, color });
  });

  app.delete("/tags/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    await tagsService.deleteTag(userId, id);
    return { success: true };
  });
}
