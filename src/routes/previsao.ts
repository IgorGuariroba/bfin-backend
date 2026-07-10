import type { FastifyInstance, FastifyReply } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import {
  PrevisaoNotFoundError,
  PrevisaoValidationError,
} from "../core/previsao/index.js";
import { previsaoService } from "../adapters/index.js";

// Mapeia erros de domínio do core para HTTP; retorna true se tratou.
function domainErrorResponse(error: unknown, reply: FastifyReply): boolean {
  if (error instanceof PrevisaoNotFoundError) {
    reply.code(404).send({ error: error.message });
    return true;
  }
  if (error instanceof PrevisaoValidationError) {
    reply.code(400).send({ error: error.message });
    return true;
  }
  return false;
}

export function previsaoRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/previsao", async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    return previsaoService.listPrevisoes(userId);
  });

  app.post("/previsao", async (request, reply) => {
    const { userId, name, amount } = request.body as {
      userId?: string;
      name?: string;
      amount?: number;
    };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      const previsao = await previsaoService.createPrevisao({
        userId,
        name: name ?? "",
        amount: amount as number,
      });
      return reply.code(201).send(previsao);
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.put("/previsao/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId, name, amount } = request.body as {
      userId?: string;
      name?: string;
      amount?: number;
    };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      return await previsaoService.updatePrevisao({ userId, id, name, amount });
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.delete("/previsao/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      await previsaoService.deletePrevisao(userId, id);
      return { success: true };
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.post("/previsao/aplicar", async (request, reply) => {
    const { userId, amount } = request.body as {
      userId?: string;
      amount?: number;
    };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      const { count } = await previsaoService.applyPrevisao({
        userId,
        amount: amount as number,
      });
      return { count };
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  // Baixa automática (ADR-0005): batch sem userId, roda pra todos os usuários
  // elegíveis. Chamada internamente pelo cron do bfin-app (que valida CRON_SECRET).
  app.post("/previsao/baixa-diaria", async () => {
    return previsaoService.baixaDiaria();
  });
}
