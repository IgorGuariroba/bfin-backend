import Fastify from "fastify";
import { tagsRoutes } from "./routes/tags.js";
import { transactionsRoutes } from "./routes/transactions.js";

export function buildApp() {
  const app = Fastify();

  app.get("/health", async () => ({ status: "ok" }));
  app.register(tagsRoutes);
  app.register(transactionsRoutes);

  return app;
}
