import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { z } from "zod";
import { parseOr400, requiredString } from "./parse.js";

const schema = z.object({
  userId: requiredString,
  name: z.string().optional(),
  amount: z.number().optional(),
  enabled: z.boolean(),
});

// Exercita o helper pela borda HTTP real (como o teste do domainErrorHandler):
// uma rota mínima que declara o schema e delega — a forma de toda rota REST.
function buildApp() {
  const app = Fastify();
  app.post("/echo", async (request, reply) => {
    const body = parseOr400(schema, request.body, reply);
    if (!body) return;
    return body;
  });
  return app;
}

describe("parseOr400", () => {
  it("sucesso devolve o objeto tipado e não toca o reply", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      payload: { userId: "u1", amount: 10, enabled: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: "u1", amount: 10, enabled: true });
  });

  it("campo ausente → 400 'é obrigatório'", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "userId é obrigatório" });
  });

  it("string vazia conta como ausente (guarda `!campo`)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      payload: { userId: "", enabled: true },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "userId é obrigatório" });
  });

  it("múltiplos ausentes → 'são obrigatórios' com todos os campos", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/echo", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: "userId e enabled são obrigatórios",
    });
  });

  it("três ou mais ausentes → vírgulas e 'e' final", async () => {
    const app = Fastify();
    app.post("/echo", async (request, reply) => {
      const body = parseOr400(
        z.object({
          apiKeyId: requiredString,
          userId: requiredString,
          entityId: requiredString,
        }),
        request.body,
        reply,
      );
      if (!body) return;
      return body;
    });
    const res = await app.inject({ method: "POST", url: "/echo", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: "apiKeyId, userId e entityId são obrigatórios",
    });
  });

  it("tipo errado → 400 'é inválido'", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      payload: { userId: "u1", amount: "x", enabled: true },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "amount é inválido" });
  });

  it("ausente tem precedência sobre inválido na mensagem", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      payload: { amount: "x", enabled: true },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "userId é obrigatório" });
  });

  it("campo extra é ignorado, não é erro", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      payload: { userId: "u1", enabled: false, extra: "ok" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: "u1", enabled: false });
  });

  it("body ausente vira objeto vazio → 400 obrigatório, não 500", async () => {
    const app = Fastify();
    app.delete("/echo", async (request, reply) => {
      const body = parseOr400(
        z.object({ userId: requiredString }),
        request.body,
        reply,
      );
      if (!body) return;
      return body;
    });
    const res = await app.inject({ method: "DELETE", url: "/echo" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "userId é obrigatório" });
  });
});
