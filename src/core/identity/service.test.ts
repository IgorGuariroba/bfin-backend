import { describe, it, expect, beforeEach } from "vitest";
import { makeIdentityService, ProRequiredError } from "./service.js";
import type { IdentityRepo } from "./ports.js";

// Repo fake em memória: prova que o core é testável sem DB e sem Next (ADR-0013).
interface FakeUser {
  plan: string;
  planExpiresAt: Date | null;
  autoBaixaDiario: boolean;
  name: string;
  email: string;
}

interface FakeMembership {
  ownerId: string;
  memberId: string;
  status: string;
}

function makeFakeRepo() {
  const users = new Map<string, FakeUser>();
  const memberships: FakeMembership[] = [];

  const repo: IdentityRepo = {
    findPlanInfo: async (userId) => {
      const user = users.get(userId);
      return user
        ? { plan: user.plan, planExpiresAt: user.planExpiresAt }
        : null;
    },
    setPlanFree: async (userId) => {
      const user = users.get(userId);
      if (user) user.plan = "free";
    },
    setAutoBaixaDiario: async (userId, enabled) => {
      const user = users.get(userId);
      if (user) user.autoBaixaDiario = enabled;
    },
    findActiveMembershipOwner: async (ownerId, memberId) => {
      const active = memberships.find(
        (m) =>
          m.ownerId === ownerId &&
          m.memberId === memberId &&
          m.status === "active",
      );
      if (!active) return null;
      const owner = users.get(ownerId)!;
      return { name: owner.name, email: owner.email };
    },
  };

  const seedUser = (id: string, over: Partial<FakeUser> = {}) =>
    users.set(id, {
      plan: "free",
      planExpiresAt: null,
      autoBaixaDiario: false,
      name: `Nome ${id}`,
      email: `${id}@example.com`,
      ...over,
    });

  return { repo, users, memberships, seedUser };
}

let fake: ReturnType<typeof makeFakeRepo>;
let service: ReturnType<typeof makeIdentityService>;

beforeEach(() => {
  fake = makeFakeRepo();
  service = makeIdentityService(fake.repo);
});

describe("resolveEffectiveUser (ADR-0011)", () => {
  it("membro ativo opera como dono: resolve para o requestedOwnerId", async () => {
    fake.seedUser("dono");
    fake.seedUser("membro");
    fake.memberships.push({
      ownerId: "dono",
      memberId: "membro",
      status: "active",
    });

    expect(await service.resolveEffectiveUser("membro", "dono")).toBe("dono");
  });

  it("sem vínculo ativo, cai no próprio sessionUserId", async () => {
    fake.seedUser("dono");
    fake.seedUser("membro");
    fake.memberships.push({
      ownerId: "dono",
      memberId: "membro",
      status: "pending",
    });

    expect(await service.resolveEffectiveUser("membro", "dono")).toBe("membro");
  });

  it("sem alvo (null/undefined) ou alvo igual à própria sessão, resolve para si", async () => {
    fake.seedUser("u1");

    expect(await service.resolveEffectiveUser("u1", null)).toBe("u1");
    expect(await service.resolveEffectiveUser("u1", undefined)).toBe("u1");
    expect(await service.resolveEffectiveUser("u1", "u1")).toBe("u1");
  });
});

describe("getDelegationInfo", () => {
  it("delegação ativa expõe nome e email do dono para a UI", async () => {
    fake.seedUser("dono", { name: "Dona Maria", email: "maria@example.com" });
    fake.seedUser("membro");
    fake.memberships.push({
      ownerId: "dono",
      memberId: "membro",
      status: "active",
    });

    expect(await service.getDelegationInfo("membro", "dono")).toEqual({
      effectiveUserId: "dono",
      isDelegated: true,
      ownerName: "Dona Maria",
      ownerEmail: "maria@example.com",
    });
  });

  it("sem alvo ou sem vínculo ativo, não é delegação", async () => {
    fake.seedUser("dono");
    fake.seedUser("membro");

    expect(await service.getDelegationInfo("membro", null)).toEqual({
      effectiveUserId: "membro",
      isDelegated: false,
    });
    expect(await service.getDelegationInfo("membro", "dono")).toEqual({
      effectiveUserId: "membro",
      isDelegated: false,
    });
  });
});

describe("getUserPlan", () => {
  it("pro vigente é pro; free e usuário inexistente são free", async () => {
    fake.seedUser("pro", { plan: "pro" });
    fake.seedUser("free");

    expect(await service.getUserPlan("pro")).toBe("pro");
    expect(await service.getUserPlan("free")).toBe("free");
    expect(await service.getUserPlan("fantasma")).toBe("free");
  });

  it("pro vencido vira free e o downgrade é persistido", async () => {
    fake.seedUser("vencido", {
      plan: "pro",
      planExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    expect(await service.getUserPlan("vencido")).toBe("free");
    expect(fake.users.get("vencido")?.plan).toBe("free");
  });

  it("pro com planExpiresAt futuro continua pro sem downgrade", async () => {
    fake.seedUser("valido", {
      plan: "pro",
      planExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    expect(await service.getUserPlan("valido")).toBe("pro");
    expect(fake.users.get("valido")?.plan).toBe("pro");
  });
});

describe("setAutoBaixaDiario", () => {
  it("free tentando ligar recebe ProRequiredError", async () => {
    fake.seedUser("free");

    await expect(
      service.setAutoBaixaDiario("free", true),
    ).rejects.toBeInstanceOf(ProRequiredError);
    expect(fake.users.get("free")?.autoBaixaDiario).toBe(false);
  });

  it("pro liga e persiste", async () => {
    fake.seedUser("pro", { plan: "pro" });

    await service.setAutoBaixaDiario("pro", true);

    expect(fake.users.get("pro")?.autoBaixaDiario).toBe(true);
  });

  it("desligar é permitido mesmo sendo free (saída do estado após downgrade)", async () => {
    fake.seedUser("free", { autoBaixaDiario: true });

    await service.setAutoBaixaDiario("free", false);

    expect(fake.users.get("free")?.autoBaixaDiario).toBe(false);
  });
});
