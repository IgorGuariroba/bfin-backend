import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import { requireInternalSecret } from "./internal-api.js";

// Fastify isolado: testa o hook de auth interna no seu seam, sem acoplar DB nem
// os services. Espelha como cada rota o registra (addHook onRequest).
function buildApp() {
  const app = Fastify();
  app.addHook("onRequest", requireInternalSecret);
  app.get("/probe", async () => ({ ok: true }));
  return app;
}

describe("requireInternalSecret", () => {
  const originalSecret = process.env.INTERNAL_API_SECRET;

  afterEach(() => {
    process.env.INTERNAL_API_SECRET = originalSecret;
  });

  it("fail-closed: sem header e sem env configurado → 401", async () => {
    delete process.env.INTERNAL_API_SECRET;
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/probe" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejeita header divergente do secret → 401", async () => {
    process.env.INTERNAL_API_SECRET = "segredo-certo";
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/probe",
      headers: { "x-internal-secret": "segredo-errado" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("aceita header igual ao secret → 200", async () => {
    process.env.INTERNAL_API_SECRET = "segredo-certo";
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/probe",
      headers: { "x-internal-secret": "segredo-certo" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("fail-closed: env configurado mas header ausente → 401", async () => {
    process.env.INTERNAL_API_SECRET = "segredo-certo";
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/probe" });
    expect(response.statusCode).toBe(401);
  });
});
