import { Readable } from "node:stream";
import type { FastifyReply, FastifyRequest } from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

/**
 * Transporte MCP sobre HTTP: encapsula a reconstrução da Web-Request a partir
 * da requisição crua do Fastify, a criação/gestão da sessão do SDK MCP e o
 * bombeamento da resposta (possivelmente streaming/SSE) direto no socket via
 * hijack. Não sabe nada de tools, auth ou rate-limit — o único conhecimento
 * aqui é o protocolo de transporte do MCP. `buildServer` é um thunk que já
 * vem com o contexto (principal) resolvido pelo chamador.
 *
 * Pré-requisito do chamador: registrar um content-type parser que devolva o
 * corpo cru como string (`parseAs: "string"`) — este módulo usa `request.body`
 * já nesse formato para reconstruir o Request Web Standard.
 */
export async function handleMcpRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  buildServer: () => McpServer,
): Promise<void> {
  const rawBody = (request.body as string | undefined) ?? "";

  // Reconstrói um Request Web Standard a partir do request cru do Fastify —
  // o transport do MCP (WebStandardStreamableHTTPServerTransport) só
  // trabalha com a Fetch API (Request/Response/ReadableStream), não com o
  // par (req, res) do Node puro que o Fastify usa por baixo.
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  // Descarta os headers que descrevem o corpo na forma em que chegou
  // (comprimido/chunked): rawBody já é texto plano e o transport recalcula
  // o que precisar a partir dele.
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  const webRequest = new Request(`http://internal${request.url}`, {
    method: request.method,
    headers,
    body: rawBody,
  });

  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  await server.connect(transport);

  const response = await transport.handleRequest(webRequest);

  // Resposta pode ser um stream SSE — sai do fluxo automático do Fastify
  // (hijack) e escreve status/headers/corpo direto no ServerResponse cru.
  reply.hijack();
  reply.raw.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) {
    Readable.fromWeb(response.body).pipe(reply.raw);
  } else {
    reply.raw.end();
  }
}
