import { traceFields } from "./lib/observabilidade.js";
import crypto from "node:crypto";
import { buildApp } from "./app.js";

const app = buildApp({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    base: {
      service: "bfin-backend",
      environment: process.env.APP_ENV ?? "production",
      version: process.env.SERVICE_VERSION ?? "unknown",
    },
    mixin: traceFields,
    serializers: {
      req: (req) => ({ method: req.method, request_id: req.id }),
      err: (err) => ({
        type: err instanceof Error ? err.name : "UnknownError",
        message: "",
        stack: "",
      }),
    },
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
