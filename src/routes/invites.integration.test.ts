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
      name: "Invites User",
      email: `invites-${crypto.randomUUID()}@example.com`,
      plan,
    })
    .returning();
  trackUser(row.id);
  return row;
}

describe("rotas de invites", () => {
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
      url: "/invites?userId=x",
    });
    expect(response.statusCode).toBe(401);
  });

  it("convida, aceita, lista dos dois lados e revoga", async () => {
    const app = buildApp();
    const dono = await seedUser("pro");
    const convidado = await seedUser("free");
    const headers = { "x-internal-secret": SECRET };

    const created = await app.inject({
      method: "POST",
      url: "/invites",
      headers,
      payload: {
        ownerId: dono.id,
        ownerEmail: dono.email,
        email: convidado.email.toUpperCase(),
      },
    });
    expect(created.statusCode).toBe(201);
    const invite = created.json();
    expect(invite).toMatchObject({
      status: "pending",
      inviteEmail: convidado.email,
    });

    const accepted = await app.inject({
      method: "POST",
      url: "/invites/accept",
      headers,
      payload: {
        userId: convidado.id,
        userEmail: convidado.email,
        token: invite.inviteToken,
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().invite).toMatchObject({
      memberId: convidado.id,
      status: "active",
    });

    const listedDono = await app.inject({
      method: "GET",
      url: `/invites?userId=${dono.id}`,
      headers,
    });
    expect(listedDono.json().sent).toHaveLength(1);

    const listedConvidado = await app.inject({
      method: "GET",
      url: `/invites?userId=${convidado.id}`,
      headers,
    });
    expect(listedConvidado.json().received).toHaveLength(1);

    const revoked = await app.inject({
      method: "DELETE",
      url: `/invites/${invite.id}`,
      headers,
      payload: { ownerId: dono.id },
    });
    expect(revoked.statusCode).toBe(200);
  });

  it("retorna 403 ao convidar sendo dono free", async () => {
    const app = buildApp();
    const dono = await seedUser("free");
    const headers = { "x-internal-secret": SECRET };

    const response = await app.inject({
      method: "POST",
      url: "/invites",
      headers,
      payload: {
        ownerId: dono.id,
        ownerEmail: dono.email,
        email: "convidado@example.com",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("retorna 404 ao revogar convite de outro dono", async () => {
    const app = buildApp();
    const dono = await seedUser("pro");
    const intruso = await seedUser("free");
    const headers = { "x-internal-secret": SECRET };

    const created = await app.inject({
      method: "POST",
      url: "/invites",
      headers,
      payload: {
        ownerId: dono.id,
        ownerEmail: dono.email,
        email: "alguem@example.com",
      },
    });
    const invite = created.json();

    const response = await app.inject({
      method: "DELETE",
      url: `/invites/${invite.id}`,
      headers,
      payload: { ownerId: intruso.id },
    });

    expect(response.statusCode).toBe(404);
  });
});
