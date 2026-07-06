// Carregado via `node --import` antes do server (ver Dockerfile). A
// instrumentação só liga quando há um destino OTLP configurado — dev e
// testes rodam sem OTel.
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  await import("@opentelemetry/auto-instrumentations-node/register");
}
