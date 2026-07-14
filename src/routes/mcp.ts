import type { FastifyInstance, FastifyRequest } from "fastify";
import { apiKeysService } from "../adapters/index.js";
import { checkRateLimit, classifyRpc, RATE_LIMITS } from "../lib/rate-limit.js";
import { handleMcpRequest } from "../lib/mcp-transport.js";
import { buildMcpServer } from "./mcp-catalog.js";

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export function mcpRoutes(app: FastifyInstance) {
  // Captura o corpo cru em vez do JSON já parseado: precisamos do texto exato
  // pra classificar a chamada (classifyRpc) e reconstruir o Request Web
  // Standard que o transport do MCP espera — escopo desta rota só (contexto
  // encapsulado do Fastify), não afeta content-type parsing das demais rotas.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, body);
    },
  );

  // Path idêntico ao público (bfin.app/api/mcp): o Traefik/Dokploy roteia por
  // path pra esse container sem precisar de strip-path — evita ambiguidade
  // sobre o que seria removido (a rota é a única exposta publicamente aqui,
  // as demais deste processo são internas, atrás de INTERNAL_API_SECRET).
  app.post("/api/mcp", async (request, reply) => {
    const token = bearerToken(request);
    if (!token) {
      console.warn("apikey: auth denied", { reason: "missing_token" });
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const principal = await apiKeysService.resolvePrincipal(token);
    if (!principal) {
      console.warn("apikey: auth denied", { reason: "invalid_token" });
      return reply.code(401).send({ error: "Unauthorized" });
    }

    // Rate limit por ApiKey, separado por leitura/escrita (ADR-0004).
    const rawBody = (request.body as string | undefined) ?? "";
    const kind = classifyRpc(rawBody);
    const limit = checkRateLimit(
      `${principal.apiKeyId}:${kind}`,
      RATE_LIMITS[kind],
    );
    if (!limit.allowed) {
      console.warn("apikey: rate limited", {
        apiKeyId: principal.apiKeyId,
        kind,
      });
      reply.header("retry-after", String(limit.retryAfter));
      return reply.code(429).send({ error: "Rate limit exceeded" });
    }

    await handleMcpRequest(request, reply, () =>
      buildMcpServer(principal.userId, principal.apiKeyId),
    );
  });
}
