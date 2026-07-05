import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { accountMember, user as userTable } from "../../db/schema.js";
import { toDbTimestamp } from "./timestamp.js";
import { identityService } from "../index.js";
import { IdentityUserNotFoundError } from "../../core/identity/index.js";
import { drizzleIdentityRepo } from "./identity-repo.js";
import { trackCreatedUsers } from "./test-helpers.js";

const trackUser = trackCreatedUsers();

async function seedUser(opts: { plan?: string; planExpiresAt?: Date } = {}) {
  const [user] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Identity User",
      email: `identity-${crypto.randomUUID()}@example.com`,
      plan: opts.plan ?? "free",
      planExpiresAt: opts.planExpiresAt ? toDbTimestamp(opts.planExpiresAt) : undefined,
    })
    .returning();
  trackUser(user.id);
  return user;
}

describe("Identity repo not found", () => {
  it("setPlanFree rejeita userId inexistente com erro tipado", async () => {
    await expect(drizzleIdentityRepo.setPlanFree(crypto.randomUUID())).rejects.toBeInstanceOf(
      IdentityUserNotFoundError
    );
  });

  it("setAutoBaixaDiario rejeita userId inexistente com erro tipado", async () => {
    await expect(
      drizzleIdentityRepo.setAutoBaixaDiario(crypto.randomUUID(), true)
    ).rejects.toBeInstanceOf(IdentityUserNotFoundError);
  });
});

describe("getUserPlan", () => {
  it("faz downgrade preguiçoso e persiste quando o pro está vencido", async () => {
    const user = await seedUser({ plan: "pro", planExpiresAt: new Date(Date.now() - 1000) });

    expect(await identityService.getUserPlan(user.id)).toBe("free");
    const [after] = await db.select().from(userTable).where(eq(userTable.id, user.id));
    expect(after?.plan).toBe("free");
  });

  it("mantém pro quando planExpiresAt é no futuro", async () => {
    const user = await seedUser({ plan: "pro", planExpiresAt: new Date(Date.now() + 86_400_000) });
    expect(await identityService.getUserPlan(user.id)).toBe("pro");
  });

  it("usuário inexistente é free (fail-closed)", async () => {
    expect(await identityService.getUserPlan(crypto.randomUUID())).toBe("free");
  });
});

describe("resolveEffectiveUser / getDelegationInfo", () => {
  it("resolve o dono quando há AccountMember ativo", async () => {
    const dono = await seedUser({ plan: "pro" });
    const membro = await seedUser();
    // Não precisa de cleanup próprio: cai em cascade junto com o User (onDelete: cascade).
    await db.insert(accountMember).values({
      id: crypto.randomUUID(),
      ownerId: dono.id,
      memberId: membro.id,
      inviteEmail: membro.email,
      inviteToken: crypto.randomUUID(),
      status: "active",
    });

    expect(await identityService.resolveEffectiveUser(membro.id, dono.id)).toBe(dono.id);
    expect(await identityService.getDelegationInfo(membro.id, dono.id)).toMatchObject({
      effectiveUserId: dono.id,
      isDelegated: true,
      ownerName: dono.name,
      ownerEmail: dono.email,
    });
  });

  it("ignora delegação sem vínculo ativo", async () => {
    const dono = await seedUser({ plan: "pro" });
    const estranho = await seedUser();

    expect(await identityService.resolveEffectiveUser(estranho.id, dono.id)).toBe(estranho.id);
  });
});
