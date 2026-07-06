import Fastify, { type FastifyServerOptions } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "./lib/drizzle.js";
import { tagsRoutes } from "./routes/tags.js";
import { transactionsRoutes } from "./routes/transactions.js";
import { previsaoRoutes } from "./routes/previsao.js";
import { identityRoutes } from "./routes/identity.js";
import { invitesRoutes } from "./routes/invites.js";
import { apikeysRoutes } from "./routes/apikeys.js";
import { billingRoutes } from "./routes/billing.js";
import { insightsRoutes } from "./routes/insights.js";
import { mcpRoutes } from "./routes/mcp.js";
import { webhookMercadoPagoRoutes } from "./routes/webhook-mercadopago.js";

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);

  // Healthcheck do Dokploy: só é "ok" se o Postgres responde.
  app.get("/health", async (_req, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: "ok" };
    } catch {
      return reply.status(503).send({ status: "degraded" });
    }
  });
  app.register(tagsRoutes);
  app.register(transactionsRoutes);
  app.register(previsaoRoutes);
  app.register(identityRoutes);
  app.register(invitesRoutes);
  app.register(apikeysRoutes);
  app.register(billingRoutes);
  app.register(insightsRoutes);
  app.register(mcpRoutes);
  app.register(webhookMercadoPagoRoutes);

  return app;
}
