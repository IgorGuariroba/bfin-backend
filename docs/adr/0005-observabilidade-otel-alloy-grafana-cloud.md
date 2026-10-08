# Observabilidade: OpenTelemetry + Alloy no servidor + Grafana Cloud

A observabilidade é o feedback loop pós-deploy: latência por endpoint, exceções novas, memória, usuário afetado, regressão introduzida. Até aqui produção rodava cega — o `Fastify()` estava sem logger, então nenhum request ou exceção era registrado.

Três camadas: **(1)** logger pino do Fastify ligado (JSON no stdout, request-id, redact de Authorization/API key/cookie) e `/health` checando o Postgres; **(2)** instrumentação `@opentelemetry/auto-instrumentations-node` (HTTP, Fastify, pg) carregada via `--import` e ativa só quando `OTEL_EXPORTER_OTLP_ENDPOINT` existe — dev e testes rodam sem OTel; **(3)** Grafana Alloy como stack separado no Dokploy (`docker-compose.alloy.yml`), recebendo OTLP do app e coletando logs e métricas de todos os containers via Docker socket, encaminhando tudo ao gateway OTLP do Grafana Cloud. Credenciais só nas env vars do Dokploy.

Alternativas rejeitadas: **Sentry** (resolveria erros e tracing com menos setup, mas não cobre métricas de infra com histórico — e a preferência foi por stack vendor-neutral completa); **export direto do app ao Grafana Cloud** (sem Alloy não há logs de containers nem métricas de host, e cada novo serviço repetiria as credenciais); **node_exporter no Alloy** (exigiria mounts privilegiados do host; as métricas de container do cadvisor respondem a pergunta que importa — a memória do backend — e o resto fica no painel do Dokploy).

## Revisão — 07/10/2026: infraestrutura própria na VPS única

Destino revisado para OpenObserve OSS, gerido pelo Dokploy, após dimensionar a VPS de 2 CPUs/8 GB/100 GB. O backend recebe 1536 MiB/0,75 CPU e retenção global sete dias. Interface HTTPS separada; OTLP só na rede privada. Uptime Kuma complementa disponibilidade.

Reaproveitamos o SDK existente e a identidade DNS `alloy:4318`; não há segundo SDK. Logs JSON de stdout são a fonte única (`OTEL_LOGS_EXPORTER=none`). Alloy v1.20.1/digest fixado, teto 1 GiB/0,5 CPU, fila de 256 batches, sanitização por allowlist e posições persistentes. Métricas internas/cAdvisor/host expõem perdas, filas e capacidade. Credenciais do OpenObserve são exclusivas e ficam no painel, sem reutilizar as do Cloud.

O webhook tem spans para recepção, validação, processamento, gateway, persistência e a verificação de idempotência de conversões já existente. O identificador pesquisável é HMAC do ID externo com o segredo do webhook: reentregas correlacionam sem publicar o ID financeiro. A deduplicação medida é a de conversões; instrumentação não muda a idempotência do domínio nem impede novas notificações de assinatura. MCP registra classificação/duração sem argumentos.

O piloto coleta traces integralmente, com fila limitada; indisponibilidade prolongada pode perder dados. Retenção não equivale a backup. A configuração anterior foi guardada em Downloads para reversão sem apagar volumes. Dados e exercícios sintéticos validam correlação/sanitização; aceites de produção e procedimentos operacionais ficam no diário da implementação.
