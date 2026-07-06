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
      name: "Tx User",
      email: `tx-route-${crypto.randomUUID()}@example.com`,
      plan: "pro",
    })
    .returning();
  trackUser(row.id);
  return row;
}

describe("rotas de transactions", () => {
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
      url: "/transactions?userId=x",
    });
    expect(response.statusCode).toBe(401);
  });

  it("cria, lista, atualiza e exclui uma transaction do usuário", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const created = await app.inject({
      method: "POST",
      url: "/transactions",
      headers,
      payload: {
        userId: user.id,
        type: "saida",
        description: "Café",
        amount: 9.5,
        date: "2026-06-15",
        force: true,
      },
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json();
    expect(createdBody.duplicated).toBe(false);
    const tx = createdBody.transaction;
    expect(tx.description).toBe("Café");

    const listed = await app.inject({
      method: "GET",
      url: `/transactions?userId=${user.id}`,
      headers,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().some((t: { id: string }) => t.id === tx.id)).toBe(
      true,
    );

    const updated = await app.inject({
      method: "PUT",
      url: `/transactions/${tx.id}`,
      headers,
      payload: { userId: user.id, description: "Café da manhã" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().description).toBe("Café da manhã");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/transactions/${tx.id}`,
      headers,
      payload: { userId: user.id },
    });
    expect(deleted.statusCode).toBe(204);
  });

  it("sem force, detecta candidata duplicata e não cria de novo", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const first = await app.inject({
      method: "POST",
      url: "/transactions",
      headers,
      payload: {
        userId: user.id,
        type: "saida",
        description: "Mercado",
        amount: 100,
        date: "2026-06-15",
        force: true,
      },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/transactions",
      headers,
      payload: {
        userId: user.id,
        type: "saida",
        description: "Mercado de novo",
        amount: 100,
        date: "2026-06-16",
      },
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().duplicated).toBe(true);
  });

  it("retorna 400 em validação inválida (amount negativo)", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const response = await app.inject({
      method: "POST",
      url: "/transactions",
      headers,
      payload: {
        userId: user.id,
        type: "saida",
        description: "Teste",
        amount: -5,
        date: "2026-06-15",
        force: true,
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it("retorna 404 ao atualizar transaction inexistente", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    const response = await app.inject({
      method: "PUT",
      url: `/transactions/${crypto.randomUUID()}`,
      headers,
      payload: { userId: user.id, description: "x" },
    });
    expect(response.statusCode).toBe(404);
  });

  it("POST /transactions/suggest resolve type e tagId a partir da descrição", async () => {
    const app = buildApp();
    const user = await seedUser();
    const headers = { "x-internal-secret": SECRET };

    await app.inject({
      method: "POST",
      url: "/tags",
      headers,
      payload: { userId: user.id, name: "Transporte", color: "#4a90e2" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/transactions/suggest",
      headers,
      payload: { userId: user.id, description: "uber pro trabalho" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.type).toBe("saida");
    expect(body.tagId).toBeTruthy();
  });
});
