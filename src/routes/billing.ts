import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalSecret } from "./internal-api.js";
import { billingService } from "../adapters/index.js";
import { parseOr400, requiredString } from "./parse.js";

const planConfigBodySchema = z.object({
  monthlyAmount: z.number(),
  annualAmount: z.number(),
});

const userIdQuerySchema = z.object({ userId: requiredString });

const userIdBodySchema = z.object({ userId: requiredString });

const checkoutBodySchema = z.object({
  userId: requiredString,
  email: z.string().nullish(),
  cycle: z.enum(["monthly", "annual"]),
  origin: requiredString,
  click: z
    .object({
      gclid: z.string().optional(),
      gbraid: z.string().optional(),
      wbraid: z.string().optional(),
    })
    .optional(),
});

export function billingRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.get("/billing/plan-prices", async () => {
    return billingService.getPlanPrices();
  });

  app.get("/billing/plan-config", async () => {
    return billingService.getPlanConfig();
  });

  app.put("/billing/plan-config", async (request, reply) => {
    const body = parseOr400(planConfigBodySchema, request.body, reply);
    if (!body) return;
    return billingService.updatePlanConfig(body);
  });

  app.get("/billing/subscription", async (request, reply) => {
    const query = parseOr400(userIdQuerySchema, request.query, reply);
    if (!query) return;
    return billingService.getSubscription(query.userId);
  });

  app.delete("/billing/subscription", async (request, reply) => {
    const body = parseOr400(userIdBodySchema, request.body, reply);
    if (!body) return;
    await billingService.cancelSubscription(body.userId);
    return { ok: true };
  });

  app.post("/billing/checkout", async (request, reply) => {
    const body = parseOr400(checkoutBodySchema, request.body, reply);
    if (!body) return;
    return billingService.checkout({ ...body, email: body.email });
  });
}
