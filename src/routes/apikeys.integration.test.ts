import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../lib/drizzle.js";
import { user as userTable } from "../db/schema.js";
import { trackCreatedUsers } from "../adapters/drizzle/test-helpers.js";
import { buildApp } from "../app.js";

const trackUser = trackCreatedUsers();
const SECRET = "test-secret";

async function seedUser(plan = "pro") {
  const [row] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "ApiKeys Route User",
      email: `apikeys-route-${crypto.randomUUID()}@example.com`,
      plan,
    })
    .returning();
  trackUser(row.id);
  return row;
}

describe("rotas de apikeys", () => {
  let originalSecret: string | undefined;

  beforeAll(() => {
    originalSecret = process.env.INTERNAL_API_SECRET;
    process.env.INTERNAL_API_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.INTERNAL_API_SECRET = originalSecret;
  });

  it("rejeita sem o header do segredo compartilhado", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/apikeys?userId=x" });
    expect(response.statusCode).toBe(401);
  });

  it("emite, lista e revoga uma chave", async () => {
    const app = buildApp();
    const user = await seedUser("pro");
    const headers = { "x-internal-secret": SECRET };

    const issued = await app.inject({
      method: "POST",
      url: "/apikeys",
      headers,
      payload: { userId: user.id },
    });
    expect(issued.statusCode).toBe(201);
    const key = issued.json();
    expect(key.plain).toMatch(/^sk-bfin-/);

    const listed = await app.inject({ method: "GET", url: `/apikeys?userId=${user.id}`, headers });
    expect(listed.json()).toHaveLength(1);

    const revoked = await app.inject({
      method: "DELETE",
      url: `/apikeys/${key.id}`,
      headers,
      payload: { userId: user.id },
    });
    expect(revoked.statusCode).toBe(200);
  });

  it("retorna 403 ao emitir pra usuário free", async () => {
    const app = buildApp();
    const user = await seedUser("free");
    const headers = { "x-internal-secret": SECRET };

    const response = await app.inject({ method: "POST", url: "/apikeys", headers, payload: { userId: user.id } });

    expect(response.statusCode).toBe(403);
  });

  it("resolve o principal de um token válido", async () => {
    const app = buildApp();
    const user = await seedUser("pro");
    const headers = { "x-internal-secret": SECRET };
    const issued = await app.inject({
      method: "POST",
      url: "/apikeys",
      headers,
      payload: { userId: user.id },
    });
    const key = issued.json();

    const response = await app.inject({
      method: "POST",
      url: "/apikeys/resolve-principal",
      headers,
      payload: { token: key.plain },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: user.id, apiKeyId: key.id });
  });

  it("resolve null pra token inválido", async () => {
    const app = buildApp();
    const headers = { "x-internal-secret": SECRET };

    const response = await app.inject({
      method: "POST",
      url: "/apikeys/resolve-principal",
      headers,
      payload: { token: "sk-bfin-nao-existe" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();
  });

  it("registra a auditoria de uma escrita do agente", async () => {
    const app = buildApp();
    const user = await seedUser("pro");
    const headers = { "x-internal-secret": SECRET };
    const issued = await app.inject({
      method: "POST",
      url: "/apikeys",
      headers,
      payload: { userId: user.id },
    });
    const key = issued.json();

    const response = await app.inject({
      method: "POST",
      url: "/apikeys/record-write",
      headers,
      payload: { apiKeyId: key.id, userId: user.id, action: "create", entityId: "tx-1" },
    });

    expect(response.statusCode).toBe(204);
  });
});
