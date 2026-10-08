import { context, metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { createHmac } from "node:crypto";

const tracer = trace.getTracer("bfin-backend.business");
const meter = metrics.getMeter("bfin-backend.business");
const total = meter.createCounter("bfin.operacao.total");
const webhookResults = meter.createCounter("bfin.webhook.resultado.total");
const duration = meter.createHistogram("bfin.operacao.duracao", { unit: "s" });

export function traceFields() {
  const span = trace.getSpan(context.active())?.spanContext();
  return span && trace.isSpanContextValid(span)
    ? { trace_id: span.traceId, span_id: span.spanId }
    : {};
}

/** IDs externos nunca vão para métricas ou logs; HMAC evita reversão por dicionário. */
export function operationId(externalId: string, secret: string) {
  return createHmac("sha256", secret)
    .update(externalId)
    .digest("hex")
    .slice(0, 32);
}

export function logEvent(event: string, result: string, operation_id?: string) {
  if (event === "webhook.result" || event === "webhook.idempotency")
    webhookResults.add(1, { stage: event, result });
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      level: result === "error" ? 50 : 30,
      service: "bfin-backend",
      environment: process.env.APP_ENV ?? "production",
      version: process.env.SERVICE_VERSION ?? "unknown",
      event,
      result,
      ...(operation_id ? { operation_id } : {}),
      ...traceFields(),
    }),
  );
}

/** Apenas nomes de operações definidos em código: sem parâmetros, SQL ou exceções brutas. */
export async function observe<T>(
  operation: string,
  execute: () => Promise<T>,
  operation_id?: string,
): Promise<T> {
  return tracer.startActiveSpan(operation, async (span) => {
    const started = performance.now();
    let result = "success";
    if (operation_id) span.setAttribute("operation.id", operation_id);
    try {
      return await execute();
    } catch (error) {
      result = "error";
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute(
        "error.type",
        error instanceof Error ? error.name : "UnknownError",
      );
      throw error;
    } finally {
      span.setAttribute("operation.result", result);
      const attributes = { operation, result };
      total.add(1, attributes);
      duration.record((performance.now() - started) / 1000, attributes);
      logEvent(operation, result, operation_id);
      span.end();
    }
  });
}
