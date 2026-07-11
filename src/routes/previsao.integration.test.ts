import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../lib/drizzle.js";
import { user as userTable } from "../db/schema.js";
import { trackCreatedUsers } from "../adapters/drizzle/test-helpers.js";
import { buildApp } from "../app.js";

const trackUser = trackCreatedUsers();
const SECRET = "test-secret";

async function seedUser() {
  const [row] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Previsao User",
      email: `previsao-route-${crypto.randomUUID()}@example.com`,
      plan: "pro",
    })
    .returning();
  trackUser(row.id);
  return row;
}

describe("rotas de previsão", () => {
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
    const response = await app.inject({
      method: "GET",
      url: "/previsao?userId=x",
    });
    expect(response.statusCode).toBe(401);
  });

  it("rejeita com o segredo errado", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/previsao?userId=x",
      headers: { "x-internal-secret": "errado" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("cria, lista, atualiza e exclui uma previsão do usuário", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const created = await app.inject({
      method: "POST",
      url: "/previsao",
      headers,
      payload: { userId: user.id, name: "Mercado", amount: 800 },
    });
    expect(created.statusCode).toBe(201);
    const previsao = created.json();
    expect(previsao).toMatchObject({ name: "Mercado", amount: 800 });

    const listed = await app.inject({
      method: "GET",
      url: `/previsao?userId=${user.id}`,
      headers,
    });
    expect(listed.statusCode).toBe(200);
    expect(
      listed.json().some((p: { id: string }) => p.id === previsao.id),
    ).toBe(true);

    const updated = await app.inject({
      method: "PUT",
      url: `/previsao/${previsao.id}`,
      headers,
      payload: { userId: user.id, amount: 900 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ name: "Mercado", amount: 900 });

    const deleted = await app.inject({
      method: "DELETE",
      url: `/previsao/${previsao.id}`,
      headers,
      payload: { userId: user.id },
    });
    expect(deleted.statusCode).toBe(200);
  });

  it("retorna 400 ao criar com dados inválidos", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const response = await app.inject({
      method: "POST",
      url: "/previsao",
      headers,
      payload: { userId: user.id, name: "", amount: 800 },
    });

    expect(response.statusCode).toBe(400);
  });

  it("retorna 404 ao editar previsão de outro dono", async () => {
    const app = buildApp();
    const dono = await seedUser();
    const invasor = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const created = await app.inject({
      method: "POST",
      url: "/previsao",
      headers,
      payload: { userId: dono.id, name: "Mercado", amount: 800 },
    });
    const previsao = created.json();

    const response = await app.inject({
      method: "PUT",
      url: `/previsao/${previsao.id}`,
      headers,
      payload: { userId: invasor.id, amount: 1 },
    });

    expect(response.statusCode).toBe(404);
  });

  it("aplica a previsão diária e retorna o count de placeholders criados", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const response = await app.inject({
      method: "POST",
      url: "/previsao/aplicar",
      headers,
      payload: { userId: user.id, amount: 150 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().count).toBeGreaterThanOrEqual(365);
  });

  it("retorna 400 ao aplicar previsão com amount inválido", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const response = await app.inject({
      method: "POST",
      url: "/previsao/aplicar",
      headers,
      payload: { userId: user.id, amount: "150" },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("validação de campos obrigatórios (parse zod)", () => {
  let originalSecret: string | undefined;

  beforeAll(() => {
    originalSecret = process.env.INTERNAL_API_SECRET;
    process.env.INTERNAL_API_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.INTERNAL_API_SECRET = originalSecret;
  });

  it("retorna 400 uniforme quando campo obrigatório falta", async () => {
    const app = buildApp();
    const headers = { "x-internal-secret": SECRET };

    const semUserId = await app.inject({
      method: "GET",
      url: "/previsao",
      headers,
    });
    expect(semUserId.statusCode).toBe(400);
    expect(semUserId.json()).toEqual({ error: "userId é obrigatório" });

    const cases = [
      { method: "POST" as const, url: "/previsao", payload: {} },
      { method: "PUT" as const, url: "/previsao/x", payload: {} },
      { method: "DELETE" as const, url: "/previsao/x", payload: {} },
      { method: "POST" as const, url: "/previsao/aplicar", payload: {} },
    ];
    for (const { method, url, payload } of cases) {
      const res = await app.inject({ method, url, headers, payload });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/obrigatóri/);
    }
  });
});
