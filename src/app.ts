import Fastify from "fastify";
import { tagsRoutes } from "./routes/tags.js";
import { transactionsRoutes } from "./routes/transactions.js";
import { previsaoRoutes } from "./routes/previsao.js";

export function buildApp() {
  const app = Fastify();

  app.get("/health", async () => ({ status: "ok" }));
  app.register(tagsRoutes);
  app.register(transactionsRoutes);
  app.register(previsaoRoutes);

  return app;
}
