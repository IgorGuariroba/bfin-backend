import Fastify from "fastify";
import { tagsRoutes } from "./routes/tags.js";

export function buildApp() {
  const app = Fastify();

  app.get("/health", async () => ({ status: "ok" }));
  app.register(tagsRoutes);

  return app;
}
