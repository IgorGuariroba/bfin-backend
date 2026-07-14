import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalSecret } from "./internal-api.js";
import { apiKeysService } from "../adapters/index.js";
import { parseOr400, requiredString } from "./parse.js";

const userIdQuerySchema = z.object({ userId: requiredString });

const userIdBodySchema = z.object({ userId: requiredString });

const idParamsSchema = z.object({ id: z.string() });

const resolvePrincipalBodySchema = z.object({ token: requiredString });

const recordWriteBodySchema = z.object({
  apiKeyId: requiredString,
  userId: requiredString,
  action: z.enum(["create", "update", "delete"]),
  entityId: requiredString,
});

export function apikeysRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/apikeys", async (request, reply) => {
    const query = parseOr400(userIdQuerySchema, request.query, reply);
    if (!query) return;
    return apiKeysService.listApiKeys(query.userId);
  });

  app.post("/apikeys", async (request, reply) => {
    const body = parseOr400(userIdBodySchema, request.body, reply);
    if (!body) return;
    const issued = await apiKeysService.issueApiKey(body.userId);
    return reply.code(201).send(issued);
  });

  app.delete("/apikeys/:id", async (request, reply) => {
    const params = parseOr400(idParamsSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(userIdBodySchema, request.body, reply);
    if (!body) return;
    await apiKeysService.revokeApiKey(body.userId, params.id);
    return { success: true };
  });

  app.post("/apikeys/resolve-principal", async (request, reply) => {
    const body = parseOr400(resolvePrincipalBodySchema, request.body, reply);
    if (!body) return;
    const principal = await apiKeysService.resolvePrincipal(body.token);
    return principal;
  });

  app.post("/apikeys/record-write", async (request, reply) => {
    const body = parseOr400(recordWriteBodySchema, request.body, reply);
    if (!body) return;
    await apiKeysService.recordAgentWrite(body);
    return reply.code(204).send();
  });
}
