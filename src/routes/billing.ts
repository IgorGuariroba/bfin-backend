import type { FastifyInstance, FastifyReply } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import { BillingValidationError } from "../core/billing/index.js";
import { billingService } from "../adapters/index.js";

// Mapeia erros de domínio do core para HTTP; retorna true se tratou.
function domainErrorResponse(error: unknown, reply: FastifyReply): boolean {
  if (error instanceof BillingValidationError) {
    reply.code(400).send({ error: error.message });
    return true;
  }
  return false;
}

export function billingRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/billing/plan-prices", async () => {
    return billingService.getPlanPrices();
  });

  app.get("/billing/plan-config", async () => {
    return billingService.getPlanConfig();
  });

  app.put("/billing/plan-config", async (request, reply) => {
    const { monthlyAmount, annualAmount } = request.body as {
      monthlyAmount?: number;
      annualAmount?: number;
    };
    try {
      return await billingService.updatePlanConfig({
        monthlyAmount: monthlyAmount as number,
        annualAmount: annualAmount as number,
      });
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.get("/billing/subscription", async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    return billingService.getSubscription(userId);
  });

  app.delete("/billing/subscription", async (request, reply) => {
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    try {
      await billingService.cancelSubscription(userId);
      return { ok: true };
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });

  app.post("/billing/checkout", async (request, reply) => {
    const { userId, email, cycle, origin, click } = request.body as {
      userId?: string;
      email?: string | null;
      cycle?: "monthly" | "annual";
      origin?: string;
      click?: { gclid?: string; gbraid?: string; wbraid?: string };
    };
    if (!userId || !origin) {
      return reply
        .code(400)
        .send({ error: "userId e origin são obrigatórios" });
    }
    try {
      return await billingService.checkout({
        userId,
        email,
        cycle: cycle as "monthly" | "annual",
        origin,
        click,
      });
    } catch (error) {
      if (domainErrorResponse(error, reply)) return;
      throw error;
    }
  });
}
