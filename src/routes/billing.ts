import type { FastifyInstance } from "fastify";
import { requireInternalSecret } from "./internal-api.js";
import { billingService } from "../adapters/index.js";

export function billingRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/billing/plan-prices", async () => {
    return billingService.getPlanPrices();
  });

  app.get("/billing/plan-config", async () => {
    return billingService.getPlanConfig();
  });

  app.put("/billing/plan-config", async (request) => {
    const { monthlyAmount, annualAmount } = request.body as {
      monthlyAmount?: number;
      annualAmount?: number;
    };
    return billingService.updatePlanConfig({
      monthlyAmount: monthlyAmount as number,
      annualAmount: annualAmount as number,
    });
  });

  app.get("/billing/subscription", async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    return billingService.getSubscription(userId);
  });

  app.delete("/billing/subscription", async (request, reply) => {
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.code(400).send({ error: "userId é obrigatório" });
    await billingService.cancelSubscription(userId);
    return { ok: true };
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
    return billingService.checkout({
      userId,
      email,
      cycle: cycle as "monthly" | "annual",
      origin,
      click,
    });
  });
}
