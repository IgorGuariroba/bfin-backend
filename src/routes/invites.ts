import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  InviteForbiddenError,
  InviteNotFoundError,
  InviteValidationError,
  ProRequiredError,
} from "../core/identity/index.js";
import { membersService } from "../adapters/index.js";

/** Compara em tempo constante; length-mismatch → false (timingSafeEqual exige buffers do mesmo tamanho). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function requireInternalSecret(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const secret = process.env.INTERNAL_API_SECRET;
  const provided = request.headers["x-internal-secret"];
  if (!secret || typeof provided !== "string" || !safeEqual(provided, secret)) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  done();
}

// Mapeia erros de domínio do core para HTTP; retorna true se tratou.
function domainErrorResponse(error: unknown, reply: FastifyReply): boolean {
  if (error instanceof InviteNotFoundError) {
    reply.code(404).send({ error: error.message });
    return true;
  }
  if (error instanceof InviteForbiddenError) {
    reply.code(403).send({ error: error.message });
    return true;
  }
  if (error instanceof ProRequiredError) {
    reply.code(403).send({ error: error.message, upgrade: true });
    return true;
  }
  if (error instanceof InviteValidationError) {
    reply.code(400).send({ error: error.message });
    return true;
  }
  return false;
}

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
    if (!ownerId) return reply.code(400).send({ error: "ownerId é obrigatório" });
    try {
      const invite = await membersService.createInvite({ ownerId, ownerEmail, email: email ?? "" });
      return reply.code(201).send(invite);
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.post("/invites/accept", async (request, reply) => {
    const { userId, userEmail, token } = request.body as {
      userId?: string;
      userEmail?: string | null;
      token?: string;
    };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      const result = await membersService.acceptInvite({ userId, userEmail, token: token ?? "" });
      return result;
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.delete("/invites/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { ownerId } = request.body as { ownerId?: string };
    if (!ownerId) return reply.code(400).send({ error: "ownerId é obrigatório" });
    try {
      await membersService.revokeInvite(ownerId, id);
      return { success: true };
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });
}
