import { describe, it, expect, beforeEach } from "vitest";
import { makeBillingService, BillingValidationError } from "./service.js";
import type { BillingRepo, PaymentGateway } from "./ports.js";
import type { PlanConfigRecord } from "./types.js";

// Fakes em memória: provam que o core é testável sem DB, sem Next e sem SDK do
// MercadoPago (ADR-0013).
interface FakeUser {
  email: string;
  plan: string;
  planExpiresAt: Date | null;
  mpSubscriptionId: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  conversionReportedAt: Date | null;
}

function makeFakes() {
  let config: PlanConfigRecord = {
    id: "default",
    monthlyAmount: 14.9,
    annualAmount: 119.9,
    updatedAt: new Date(2026, 0, 1),
  };
  const users = new Map<string, FakeUser>();
  const gatewayCalls: Record<string, unknown[]> = {
    create: [],
    get: [],
    cancel: [],
  };
  let remoteSubscription: {
    id: string | undefined;
    status: string | undefined;
    externalReference: string | undefined;
    transactionAmount: number | undefined;
  } = {
    id: undefined,
    status: undefined,
    externalReference: undefined,
    transactionAmount: undefined,
  };

  const repo: BillingRepo = {
    getPlanConfig: async () => config,
    updatePlanConfig: async (monthlyAmount, annualAmount) => {
      config = {
        ...config,
        monthlyAmount,
        annualAmount,
        updatedAt: new Date(),
      };
      return config;
    },
    findSubscription: async (userId) => {
      const u = users.get(userId);
      return u
        ? {
            plan: u.plan,
            planExpiresAt: u.planExpiresAt,
            mpSubscriptionId: u.mpSubscriptionId,
          }
        : null;
    },
    clearSubscription: async (userId) => {
      const u = users.get(userId);
      if (u) u.mpSubscriptionId = null;
    },
    activatePro: async (userId, planExpiresAt, mpSubscriptionId) => {
      const u = users.get(userId)!;
      u.plan = "pro";
      u.planExpiresAt = planExpiresAt;
      u.mpSubscriptionId = mpSubscriptionId;
      return {
        email: u.email,
        gclid: u.gclid,
        gbraid: u.gbraid,
        wbraid: u.wbraid,
      };
    },
    captureClickAttribution: async (userId, click) => {
      const u = users.get(userId);
      if (!u || u.gclid || u.gbraid || u.wbraid) return;
      u.gclid = click.gclid ?? null;
      u.gbraid = click.gbraid ?? null;
      u.wbraid = click.wbraid ?? null;
    },
    conversionAlreadyReported: async (userId) =>
      users.get(userId)?.conversionReportedAt != null,
    markConversionReported: async (userId) => {
      const u = users.get(userId);
      if (u) u.conversionReportedAt = new Date();
    },
  };

  const gateway: PaymentGateway = {
    createSubscription: async (input) => {
      gatewayCalls.create.push(input);
      return { initPoint: "https://mp.example/init" };
    },
    getSubscription: async (id) => {
      gatewayCalls.get.push(id);
      return remoteSubscription;
    },
    cancelSubscription: async (id) => {
      gatewayCalls.cancel.push(id);
    },
  };

  const seedUser = (id: string, over: Partial<FakeUser> = {}) =>
    users.set(id, {
      email: `${id}@example.com`,
      plan: "free",
      planExpiresAt: null,
      mpSubscriptionId: null,
      gclid: null,
      gbraid: null,
      wbraid: null,
      conversionReportedAt: null,
      ...over,
    });

  return {
    repo,
    gateway,
    users,
    gatewayCalls,
    seedUser,
    setRemote: (r: Partial<typeof remoteSubscription>) => {
      remoteSubscription = { ...remoteSubscription, ...r };
    },
  };
}

let fake: ReturnType<typeof makeFakes>;
let service: ReturnType<typeof makeBillingService>;

beforeEach(() => {
  fake = makeFakes();
  service = makeBillingService(fake.repo, fake.gateway, {
    logger: { warn: () => {}, error: () => {} },
  });
});

describe("getPlanPrices", () => {
  it("expõe os preços correntes do PlanConfig", async () => {
    expect(await service.getPlanPrices()).toEqual({
      monthly: 14.9,
      annual: 119.9,
    });
  });
});

describe("updatePlanConfig", () => {
  it("persiste valores numéricos e devolve a config completa", async () => {
    const updated = await service.updatePlanConfig({
      monthlyAmount: 19.9,
      annualAmount: 149.9,
    });

    expect(updated).toMatchObject({ monthlyAmount: 19.9, annualAmount: 149.9 });
    expect(await service.getPlanPrices()).toEqual({
      monthly: 19.9,
      annual: 149.9,
    });
  });

  it("rejeita valores não numéricos", async () => {
    await expect(
      service.updatePlanConfig({
        monthlyAmount: "19.9" as never,
        annualAmount: 149.9,
      }),
    ).rejects.toBeInstanceOf(BillingValidationError);
    await expect(
      service.updatePlanConfig({
        monthlyAmount: 19.9,
        annualAmount: undefined as never,
      }),
    ).rejects.toBeInstanceOf(BillingValidationError);
  });
});

describe("getSubscription", () => {
  it("devolve a projeção do usuário; inexistente cai no default free", async () => {
    fake.seedUser("u1", { plan: "pro", mpSubscriptionId: "mp-1" });

    expect(await service.getSubscription("u1")).toMatchObject({
      plan: "pro",
      mpSubscriptionId: "mp-1",
    });
    expect(await service.getSubscription("fantasma")).toEqual({
      plan: "free",
      planExpiresAt: null,
      mpSubscriptionId: null,
    });
  });
});

describe("cancelSubscription", () => {
  it("cancela no gateway e desvincula a assinatura do usuário", async () => {
    fake.seedUser("u1", { plan: "pro", mpSubscriptionId: "mp-1" });

    await service.cancelSubscription("u1");

    expect(fake.gatewayCalls.cancel).toEqual(["mp-1"]);
    expect(fake.users.get("u1")?.mpSubscriptionId).toBeNull();
  });

  it("sem assinatura ativa é erro de validação e o gateway não é chamado", async () => {
    fake.seedUser("u1");

    await expect(service.cancelSubscription("u1")).rejects.toThrow(
      "Nenhuma assinatura ativa",
    );
    expect(fake.gatewayCalls.cancel).toHaveLength(0);
  });
});

describe("checkout", () => {
  const base = {
    userId: "u1",
    email: "u1@example.com",
    origin: "https://bfin.app",
  };

  it("cria a assinatura no gateway com preço do PlanConfig e external_reference userId:cycle", async () => {
    fake.seedUser("u1");
    await service.updatePlanConfig({
      monthlyAmount: 14.9,
      annualAmount: 149.9,
    });

    const result = await service.checkout({ ...base, cycle: "annual" });

    expect(result).toEqual({ initPoint: "https://mp.example/init" });
    expect(fake.gatewayCalls.create[0]).toMatchObject({
      reason: "bfin Pro — Anual",
      payerEmail: "u1@example.com",
      cycle: "annual",
      amount: 149.9,
      backUrl: "https://bfin.app/assinar",
      notificationUrl: "https://bfin.app/api/webhook/mercadopago",
      externalReference: "u1:annual",
    });
  });

  it("rejeita ciclo inválido e conta sem e-mail", async () => {
    fake.seedUser("u1");

    await expect(
      service.checkout({ ...base, cycle: "weekly" as never }),
    ).rejects.toThrow("Ciclo inválido");
    await expect(
      service.checkout({ ...base, email: null, cycle: "monthly" }),
    ).rejects.toThrow("Conta sem e-mail");
    expect(fake.gatewayCalls.create).toHaveLength(0);
  });

  it("captura atribuição de clique quando presente; falha na captura não bloqueia", async () => {
    fake.seedUser("u1");
    await service.checkout({
      ...base,
      cycle: "monthly",
      click: { gclid: "g-123" },
    });
    expect(fake.users.get("u1")?.gclid).toBe("g-123");

    fake.seedUser("u2");
    fake.repo.captureClickAttribution = async () => {
      throw new Error("db down");
    };
    const result = await service.checkout({
      ...base,
      userId: "u2",
      email: "u2@example.com",
      cycle: "monthly",
      click: { wbraid: "w-1" },
    });
    expect(result.initPoint).toBeTruthy();
  });
});

describe("processSubscriptionEvent", () => {
  it("authorized ativa o pro com a janela do ciclo e vincula a assinatura", async () => {
    fake.seedUser("u1");
    fake.setRemote({
      id: "mp-9",
      status: "authorized",
      externalReference: "u1:annual",
    });

    const before = Date.now();
    await service.processSubscriptionEvent("mp-9");

    const u = fake.users.get("u1")!;
    expect(u.plan).toBe("pro");
    expect(u.mpSubscriptionId).toBe("mp-9");
    const days = (u.planExpiresAt!.getTime() - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(364);
    expect(days).toBeLessThan(366);
  });

  it("cancelled/paused desvincula a assinatura sem mexer no plano", async () => {
    fake.seedUser("u1", { plan: "pro", mpSubscriptionId: "mp-9" });
    fake.setRemote({
      id: "mp-9",
      status: "cancelled",
      externalReference: "u1:monthly",
    });

    await service.processSubscriptionEvent("mp-9");

    expect(fake.users.get("u1")).toMatchObject({
      plan: "pro",
      mpSubscriptionId: null,
    });
  });

  it("evento sem userId no external_reference é ignorado", async () => {
    fake.setRemote({
      id: "mp-9",
      status: "authorized",
      externalReference: undefined,
    });

    await expect(
      service.processSubscriptionEvent("mp-9"),
    ).resolves.toBeUndefined();
  });

  it("reporta conversão uma única vez (dedup) e notifica a nova assinatura", async () => {
    const uploads: unknown[] = [];
    const notified: unknown[] = [];
    service = makeBillingService(fake.repo, fake.gateway, {
      logger: { warn: () => {}, error: () => {} },
      conversions: {
        isConfigured: () => true,
        resolveClickId: (u) =>
          u.gclid ? { type: "gclid", value: u.gclid } : null,
        upload: async (input) => {
          uploads.push(input);
          return { ok: true };
        },
      },
      notifyNewSubscription: (info) => {
        notified.push(info);
      },
    });
    fake.seedUser("u1", { gclid: "g-1" });
    fake.setRemote({
      id: "mp-9",
      status: "authorized",
      externalReference: "u1:monthly",
      transactionAmount: 14.9,
    });

    await service.processSubscriptionEvent("mp-9");
    await service.processSubscriptionEvent("mp-9"); // renovação/reenvio

    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatchObject({
      clickId: { type: "gclid", value: "g-1" },
      value: 14.9,
    });
    expect(notified).toHaveLength(2);
    expect(notified[0]).toMatchObject({
      email: "u1@example.com",
      cycle: "monthly",
      subscriptionId: "mp-9",
    });
  });

  it("falha na conversão/notificação não estoura o processamento", async () => {
    service = makeBillingService(fake.repo, fake.gateway, {
      logger: { warn: () => {}, error: () => {} },
      conversions: {
        isConfigured: () => true,
        resolveClickId: () => ({ type: "gclid", value: "g" }),
        upload: async () => {
          throw new Error("ads down");
        },
      },
      notifyNewSubscription: () => {
        throw new Error("discord down");
      },
    });
    fake.seedUser("u1", { gclid: "g-1" });
    fake.setRemote({
      id: "mp-9",
      status: "authorized",
      externalReference: "u1:monthly",
    });

    await expect(
      service.processSubscriptionEvent("mp-9"),
    ).resolves.toBeUndefined();
    expect(fake.users.get("u1")?.plan).toBe("pro");
  });
});
