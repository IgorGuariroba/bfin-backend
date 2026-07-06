import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../lib/drizzle.js";
import { accountMember, user as userTable } from "../db/schema.js";
import { trackCreatedUsers } from "../adapters/drizzle/test-helpers.js";
import { buildApp } from "../app.js";

const trackUser = trackCreatedUsers();
const SECRET = "test-secret";

async function seedUser(plan = "free") {
  const [row] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Identity Route User",
      email: `identity-route-${crypto.randomUUID()}@example.com`,
      plan,
    })
    .returning();
  trackUser(row.id);
  return row;
}

describe("rotas de identity", () => {
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
      url: "/identity/plan?userId=x",
    });
    expect(response.statusCode).toBe(401);
  });

  describe("POST /identity/resolve-effective-user", () => {
    it("resolve o dono quando há AccountMember ativo", async () => {
      const app = buildApp();
      const dono = await seedUser("pro");
      const membro = await seedUser();
      await db.insert(accountMember).values({
        id: crypto.randomUUID(),
        ownerId: dono.id,
        memberId: membro.id,
        inviteEmail: membro.email,
        inviteToken: crypto.randomUUID(),
        status: "active",
      });

      const response = await app.inject({
        method: "POST",
        url: "/identity/resolve-effective-user",
        headers: { "x-internal-secret": SECRET },
        payload: { sessionUserId: membro.id, requestedOwnerId: dono.id },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        effectiveUserId: dono.id,
        isDelegated: true,
        ownerName: dono.name,
        ownerEmail: dono.email,
      });
    });

    it("sem vínculo ativo, resolve pra própria sessão", async () => {
      const app = buildApp();
      const dono = await seedUser("pro");
      const estranho = await seedUser();

      const response = await app.inject({
        method: "POST",
        url: "/identity/resolve-effective-user",
        headers: { "x-internal-secret": SECRET },
        payload: { sessionUserId: estranho.id, requestedOwnerId: dono.id },
      });

      expect(response.json()).toMatchObject({
        effectiveUserId: estranho.id,
        isDelegated: false,
      });
    });
  });

  describe("GET /identity/plan", () => {
    it("retorna o plano efetivo do usuário", async () => {
      const app = buildApp();
      const user = await seedUser("pro");

      const response = await app.inject({
        method: "GET",
        url: `/identity/plan?userId=${user.id}`,
        headers: { "x-internal-secret": SECRET },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ plan: "pro" });
    });
  });

  describe("POST /identity/auto-baixa-diario", () => {
    it("liga pra usuário pro", async () => {
      const app = buildApp();
      const user = await seedUser("pro");

      const response = await app.inject({
        method: "POST",
        url: "/identity/auto-baixa-diario",
        headers: { "x-internal-secret": SECRET },
        payload: { userId: user.id, enabled: true },
      });

      expect(response.statusCode).toBe(204);
      const [row] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, user.id));
      expect(row.autoBaixaDiario).toBe(true);
    });

    it("retorna 403 ao ligar pra usuário free", async () => {
      const app = buildApp();
      const user = await seedUser("free");

      const response = await app.inject({
        method: "POST",
        url: "/identity/auto-baixa-diario",
        headers: { "x-internal-secret": SECRET },
        payload: { userId: user.id, enabled: true },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
