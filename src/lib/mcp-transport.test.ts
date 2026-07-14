import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleMcpRequest } from "./mcp-transport.js";

// Servidor MCP mínimo de fixture: uma tool só, sem tocar domínio/DB — exercita
// o transporte pela sua interface (requisição entra, resposta MCP sai), sem
// mockar internals do SDK (mesma abordagem do teste de integração da rota).
function buildFixtureServer(): McpServer {
  const server = new McpServer({ name: "fixture", version: "1.0.0" });
  server.registerTool(
    "echo",
    {
      description: "Devolve o texto recebido.",
      inputSchema: { text: z.string() },
    },
    async ({ text }) => ({
      content: [{ type: "text" as const, text }],
    }),
  );
  return server;
}

function buildApp() {
  const app = Fastify();
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, body);
    },
  );
  app.post("/mcp", async (request, reply) => {
    await handleMcpRequest(request, reply, buildFixtureServer);
  });
  return app;
}

function mcpInject(app: ReturnType<typeof buildApp>, body: unknown) {
  return app.inject({
    method: "POST",
    url: "/mcp",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    payload: JSON.stringify(body),
  });
}

function parseRpcResult(body: string) {
  const dataLine = body.split("\n").find((l) => l.startsWith("data:"));
  const json = JSON.parse(
    dataLine ? dataLine.slice("data:".length).trim() : body,
  );
  return json.result as {
    content?: { type: string; text: string }[];
    tools?: { name: string }[];
  };
}

describe("handleMcpRequest", () => {
  it("responde initialize com o protocolo MCP", async () => {
    const app = buildApp();
    const res = await mcpInject(app, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    });

    expect(res.statusCode).toBe(200);
    const result = parseRpcResult(res.body);
    expect(result).toBeDefined();
  });

  it("lista as tools registradas no servidor construído pelo buildServer", async () => {
    const app = buildApp();
    const res = await mcpInject(app, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    expect(res.statusCode).toBe(200);
    const result = parseRpcResult(res.body);
    expect(result.tools?.map((t) => t.name)).toEqual(["echo"]);
  });

  it("executa uma tool e devolve o content produzido", async () => {
    const app = buildApp();
    const res = await mcpInject(app, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "echo", arguments: { text: "olá" } },
    });

    expect(res.statusCode).toBe(200);
    const result = parseRpcResult(res.body);
    expect(result.content).toEqual([{ type: "text", text: "olá" }]);
  });

  it("chama buildServer uma vez por requisição, isolando o server por chamada", async () => {
    const app = Fastify();
    app.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_request, body, done) => done(null, body),
    );
    let calls = 0;
    app.post("/mcp", async (request, reply) => {
      await handleMcpRequest(request, reply, () => {
        calls++;
        return buildFixtureServer();
      });
    });

    await mcpInject(app, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    await mcpInject(app, { jsonrpc: "2.0", id: 2, method: "tools/list" });

    expect(calls).toBe(2);
  });
});
