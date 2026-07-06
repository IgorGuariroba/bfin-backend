import crypto from "node:crypto";
import { buildApp } from "./app.js";

const app = buildApp({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "req.headers.authorization",
      "req.headers['x-api-key']",
      "req.headers.cookie",
    ],
  },
  genReqId: () => crypto.randomUUID(),
  requestIdHeader: "x-request-id",
});
const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
