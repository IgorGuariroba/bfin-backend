import { describe, it, expect } from "vitest";
import { classifyDomainError } from "./error-classifier.js";
import * as apikeys from "./apikeys/index.js";
import * as billing from "./billing/index.js";
import * as identity from "./identity/index.js";
import * as insights from "./insights/index.js";
import * as previsao from "./previsao/index.js";
import * as tags from "./tags/index.js";
import * as transactions from "./transactions/index.js";

// Erros de domínio deliberadamente não-classificados: seguem propagando sem
// tratamento especial (500 no HTTP, erro cru no MCP) — comportamento anterior
// preservado, não drift.
const EXCLUDED = new Set([
  "BillingUserNotFoundError",
  "IdentityUserNotFoundError",
]);

describe("classifyDomainError", () => {
  const cases: Array<
    [
      Error,
      "validation" | "notFound" | "forbidden",
      Record<string, unknown> | undefined,
    ]
  > = [
    [new billing.BillingValidationError("x"), "validation", undefined],
    [new transactions.TransactionNotFoundError("x"), "notFound", undefined],
    [new transactions.TransactionValidationError("x"), "validation", undefined],
    [new tags.TagNotFoundError("x"), "notFound", undefined],
    [new tags.SystemTagImmutableError("x"), "forbidden", undefined],
    [new tags.TagValidationError("x"), "validation", undefined],
    [new previsao.PrevisaoNotFoundError("x"), "notFound", undefined],
    [new previsao.PrevisaoValidationError("x"), "validation", undefined],
    [new identity.InviteNotFoundError("x"), "notFound", undefined],
    [new identity.InviteForbiddenError("x"), "forbidden", undefined],
    [new identity.InviteValidationError("x"), "validation", undefined],
    [new insights.InsightsValidationError("x"), "validation", undefined],
    [new apikeys.ApiKeyNotFoundError("x"), "notFound", undefined],
    [new identity.ProRequiredError("x"), "forbidden", { upgrade: true }],
  ];

  for (const [error, kind, meta] of cases) {
    it(`${error.constructor.name} → ${kind}${meta ? ` ${JSON.stringify(meta)}` : ""}`, () => {
      expect(classifyDomainError(error)).toEqual({
        kind,
        ...(meta ? { meta } : {}),
      });
    });
  }

  it("TransactionNotFoundError é notFound, não validation (apesar de subclasse de TransactionValidationError)", () => {
    expect(
      classifyDomainError(new transactions.TransactionNotFoundError("x"))?.kind,
    ).toBe("notFound");
  });

  it("erros não-classificados viram null", () => {
    expect(classifyDomainError(new Error("x"))).toBeNull();
    expect(
      classifyDomainError(new billing.BillingUserNotFoundError("x")),
    ).toBeNull();
    expect(classifyDomainError("not an error")).toBeNull();
    expect(classifyDomainError(null)).toBeNull();
  });
});

// Teste de exaustividade: enumera as classes de erro exportadas pelos barrels
// do core e falha se alguma não tiver classificação (a menos que conste da
// lista explícita de exclusões). É o teste que teria pego o drift do MCP
// (helper de leitura só conhecia 3 classes, o mapa HTTP conhecia 14).
describe("exaustividade", () => {
  const barrels = {
    apikeys,
    billing,
    identity,
    insights,
    previsao,
    tags,
    transactions,
  };

  function isErrorClass(
    value: unknown,
  ): value is new (message: string) => Error {
    return (
      typeof value === "function" &&
      (value === Error || value.prototype instanceof Error)
    );
  }

  const errorClasses: Array<[string, new (message: string) => Error]> = [];
  for (const [module, barrel] of Object.entries(barrels)) {
    for (const [name, value] of Object.entries(barrel)) {
      if (isErrorClass(value)) errorClasses.push([`${module}.${name}`, value]);
    }
  }

  it("encontrou classes de erro para testar (sanity check do próprio teste)", () => {
    expect(errorClasses.length).toBeGreaterThan(10);
  });

  for (const [qualifiedName, ErrorClass] of errorClasses) {
    const name = ErrorClass.name;
    if (EXCLUDED.has(name)) {
      it(`${qualifiedName} está na lista de exclusão e permanece não-classificado`, () => {
        expect(classifyDomainError(new ErrorClass("x"))).toBeNull();
      });
    } else {
      it(`${qualifiedName} tem classificação`, () => {
        expect(classifyDomainError(new ErrorClass("x"))).not.toBeNull();
      });
    }
  }
});
