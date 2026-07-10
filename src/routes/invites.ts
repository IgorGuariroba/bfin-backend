import type { FastifyInstance } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import { membersService } from "../adapters/index.js";

export function invitesRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/invites", async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    return membersService.listInvites(userId);
  });

  app.post("/invites", async (request, reply) => {
    const { ownerId, ownerEmail, email } = request.body as {
      ownerId?: string;
      ownerEmail?: string | null;
      email?: string;
    };
    if (!ownerId)
      return reply.code(400).send({ error: "ownerId é obrigatório" });
    const invite = await membersService.createInvite({
      ownerId,
      ownerEmail,
      email: email ?? "",
    });
    return reply.code(201).send(invite);
  });

  app.post("/invites/accept", async (request, reply) => {
    const { userId, userEmail, token } = request.body as {
      userId?: string;
      userEmail?: string | null;
      token?: string;
    };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    return membersService.acceptInvite({
      userId,
      userEmail,
      token: token ?? "",
    });
  });

  app.delete("/invites/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { ownerId } = request.body as { ownerId?: string };
    if (!ownerId)
      return reply.code(400).send({ error: "ownerId é obrigatório" });
    await membersService.revokeInvite(ownerId, id);
    return { success: true };
  });
}
