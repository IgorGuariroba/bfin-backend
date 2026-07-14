import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalSecret } from "./internal-api.js";
import { membersService } from "../adapters/index.js";
import { parseOr400, requiredString } from "./parse.js";

const userIdQuerySchema = z.object({ userId: requiredString });

const createBodySchema = z.object({
  ownerId: requiredString,
  ownerEmail: z.string().nullish(),
  email: z.string().default(""),
});

const acceptBodySchema = z.object({
  userId: requiredString,
  userEmail: z.string().nullish(),
  token: z.string().default(""),
});

const idParamsSchema = z.object({ id: z.string() });

const ownerIdBodySchema = z.object({ ownerId: requiredString });

export function invitesRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/invites", async (request, reply) => {
    const query = parseOr400(userIdQuerySchema, request.query, reply);
    if (!query) return;
    return membersService.listInvites(query.userId);
  });

  app.post("/invites", async (request, reply) => {
    const body = parseOr400(createBodySchema, request.body, reply);
    if (!body) return;
    const invite = await membersService.createInvite({
      ...body,
      ownerEmail: body.ownerEmail,
    });
    return reply.code(201).send(invite);
  });

  app.post("/invites/accept", async (request, reply) => {
    const body = parseOr400(acceptBodySchema, request.body, reply);
    if (!body) return;
    return membersService.acceptInvite({
      ...body,
      userEmail: body.userEmail,
    });
  });

  app.delete("/invites/:id", async (request, reply) => {
    const params = parseOr400(idParamsSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(ownerIdBodySchema, request.body, reply);
    if (!body) return;
    await membersService.revokeInvite(body.ownerId, params.id);
    return { success: true };
  });
}
