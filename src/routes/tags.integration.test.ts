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
      name: "Tag User",
      email: `tags-route-${crypto.randomUUID()}@example.com`,
      plan: "pro",
    })
    .returning();
  trackUser(row.id);
  return row;
}

describe("rotas de tags", () => {
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
    const response = await app.inject({ method: "GET", url: "/tags?userId=x" });
    expect(response.statusCode).toBe(401);
  });

  it("rejeita com o segredo errado", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/tags?userId=x",
      headers: { "x-internal-secret": "errado" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("cria, lista, atualiza e exclui uma tag do usuário", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const created = await app.inject({
      method: "POST",
      url: "/tags",
      headers,
      payload: { userId: user.id, name: "Viagem", color: "#123456" },
    });
    expect(created.statusCode).toBe(201);
    const tag = created.json();
    expect(tag.name).toBe("Viagem");

    const listed = await app.inject({
      method: "GET",
      url: `/tags?userId=${user.id}`,
      headers,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().some((t: { id: string }) => t.id === tag.id)).toBe(
      true,
    );

    const updated = await app.inject({
      method: "PUT",
      url: `/tags/${tag.id}`,
      headers,
      payload: { userId: user.id, name: "Viagem Internacional" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe("Viagem Internacional");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/tags/${tag.id}`,
      headers,
      payload: { userId: user.id },
    });
    expect(deleted.statusCode).toBe(200);
  });

  it("retorna 400 ao criar tag com nome duplicado", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    await app.inject({
      method: "POST",
      url: "/tags",
      headers,
      payload: { userId: user.id, name: "Mercado", color: "#123456" },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/tags",
      headers,
      payload: { userId: user.id, name: "Mercado", color: "#123456" },
    });

    expect(duplicate.statusCode).toBe(400);
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
      url: "/tags",
      headers,
    });
    expect(semUserId.statusCode).toBe(400);
    expect(semUserId.json()).toEqual({ error: "userId é obrigatório" });

    const cases = [
      { method: "POST" as const, url: "/tags/ensure-system", payload: {} },
      { method: "POST" as const, url: "/tags", payload: {} },
      { method: "PUT" as const, url: "/tags/x", payload: {} },
      { method: "DELETE" as const, url: "/tags/x", payload: {} },
    ];
    for (const { method, url, payload } of cases) {
      const res = await app.inject({ method, url, headers, payload });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/obrigatóri/);
    }
  });
});
