import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { domainErrorReply, domainErrorHandler } from "./domain-errors.js";
import {
  BillingValidationError,
  BillingUserNotFoundError,
} from "../core/billing/index.js";
import {
  TransactionNotFoundError,
  TransactionValidationError,
} from "../core/transactions/index.js";
import {
  TagNotFoundError,
  SystemTagImmutableError,
  TagValidationError,
} from "../core/tags/index.js";
import {
  PrevisaoNotFoundError,
  PrevisaoValidationError,
} from "../core/previsao/index.js";
import {
  InviteForbiddenError,
  InviteNotFoundError,
  InviteValidationError,
  ProRequiredError,
} from "../core/identity/index.js";
import { ApiKeyNotFoundError } from "../core/apikeys/index.js";
import { InsightsValidationError } from "../core/insights/index.js";

// Mapa edge-owned: cada classe de erro de domínio → status + body. Espelha
// exatamente o que vivia nos domainErrorResponse espalhados pelas rotas.
// *UserNotFoundError continuam null (não-mapeados → 500, como hoje).
describe("domainErrorReply", () => {
  const cases: Array<[Error, number, Record<string, unknown>]> = [
    [new BillingValidationError("x"), 400, { error: "x" }],
    [new TransactionNotFoundError("x"), 404, { error: "x" }],
    [new TransactionValidationError("x"), 400, { error: "x" }],
    [new TagNotFoundError("x"), 404, { error: "x" }],
    [new SystemTagImmutableError("x"), 403, { error: "x" }],
    [new TagValidationError("x"), 400, { error: "x" }],
    [new PrevisaoNotFoundError("x"), 404, { error: "x" }],
    [new PrevisaoValidationError("x"), 400, { error: "x" }],
    [new InviteNotFoundError("x"), 404, { error: "x" }],
    [new InviteForbiddenError("x"), 403, { error: "x" }],
    [new InviteValidationError("x"), 400, { error: "x" }],
    [new InsightsValidationError("x"), 400, { error: "x" }],
    [new ApiKeyNotFoundError("x"), 404, { error: "x" }],
    [new ProRequiredError("x"), 403, { error: "x", upgrade: true }],
  ];

  for (const [error, status, body] of cases) {
    it(`${error.constructor.name} → ${status} ${JSON.stringify(body)}`, () => {
      expect(domainErrorReply(error)).toEqual({ status, body });
    });
  }

  it("TransactionNotFoundError é 404, não 400 (apesar de subclasses TransactionValidationError)", () => {
    // Protege a ordem do mapa: o NotFound específico não pode cair no Validation genérico.
    expect(domainErrorReply(new TransactionNotFoundError("x"))?.status).toBe(
      404,
    );
  });

  it("erros não-mapeados viram null (permanecem 500 no fallback)", () => {
    expect(domainErrorReply(new Error("x"))).toBeNull();
    expect(domainErrorReply(new BillingUserNotFoundError("x"))).toBeNull();
    expect(domainErrorReply("not an error")).toBeNull();
    expect(domainErrorReply(null)).toBeNull();
  });
});

// Seam: erro lançado num handler → HTTP via domainErrorHandler registrado no app.
describe("domainErrorHandler (Fastify setErrorHandler)", () => {
  function buildApp(throwable: () => unknown) {
    const app = Fastify();
    app.setErrorHandler(domainErrorHandler);
    app.get("/throw", async () => {
      throw throwable();
    });
    return app;
  }

  it("mapeia erro de domínio para status + body", async () => {
    const app = buildApp(() => new TransactionValidationError("inválido"));
    const response = await app.inject({ method: "GET", url: "/throw" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "inválido" });
  });

  it("ProRequiredError inclui upgrade: true", async () => {
    const app = buildApp(() => new ProRequiredError("exige pro"));
    const response = await app.inject({ method: "GET", url: "/throw" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "exige pro", upgrade: true });
  });

  it("erro não-domínio cai no fallback do Fastify (500)", async () => {
    const app = buildApp(() => new Error("boom"));
    const response = await app.inject({ method: "GET", url: "/throw" });
    expect(response.statusCode).toBe(500);
  });
});
