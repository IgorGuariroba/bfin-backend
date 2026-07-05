import Fastify from "fastify";
import { tagsRoutes } from "./routes/tags.js";
import { transactionsRoutes } from "./routes/transactions.js";
import { previsaoRoutes } from "./routes/previsao.js";
import { identityRoutes } from "./routes/identity.js";
import { invitesRoutes } from "./routes/invites.js";
import { apikeysRoutes } from "./routes/apikeys.js";
import { billingRoutes } from "./routes/billing.js";

export function buildApp() {
  const app = Fastify();

  app.get("/health", async () => ({ status: "ok" }));
  app.register(tagsRoutes);
  app.register(transactionsRoutes);
  app.register(previsaoRoutes);
  app.register(identityRoutes);
  app.register(invitesRoutes);
  app.register(apikeysRoutes);
  app.register(billingRoutes);

  return app;
}
