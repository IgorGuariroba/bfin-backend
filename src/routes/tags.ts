import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalSecret } from "./internal-api.js";
import { tagsService } from "../adapters/index.js";
import { parseOr400, requiredString } from "./parse.js";

const userIdQuerySchema = z.object({ userId: requiredString });

const createBodySchema = z.object({
  userId: requiredString,
  name: requiredString,
  color: z.string().optional(),
});

const updateBodySchema = z.object({
  userId: requiredString,
  name: z.string().optional(),
  color: z.string().optional(),
});

const idParamsSchema = z.object({ id: z.string() });

const userIdBodySchema = z.object({ userId: requiredString });

export function tagsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/tags", async (request, reply) => {
    const query = parseOr400(userIdQuerySchema, request.query, reply);
    if (!query) return;
    return tagsService.listTags(query.userId);
  });

  app.post("/tags/ensure-system", async (request, reply) => {
    const body = parseOr400(userIdBodySchema, request.body, reply);
    if (!body) return;
    await tagsService.ensureSystemTags(body.userId);
    return reply.code(204).send();
  });

  app.post("/tags", async (request, reply) => {
    const body = parseOr400(createBodySchema, request.body, reply);
    if (!body) return;
    const tag = await tagsService.createTag(body);
    return reply.code(201).send(tag);
  });

  app.put("/tags/:id", async (request, reply) => {
    const params = parseOr400(idParamsSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateBodySchema, request.body, reply);
    if (!body) return;
    const { userId, ...changes } = body;
    return tagsService.updateTag(userId, params.id, changes);
  });

  app.delete("/tags/:id", async (request, reply) => {
    const params = parseOr400(idParamsSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(userIdBodySchema, request.body, reply);
    if (!body) return;
    await tagsService.deleteTag(body.userId, params.id);
    return { success: true };
  });
}
