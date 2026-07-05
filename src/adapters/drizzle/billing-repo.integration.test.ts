import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { planConfig, user as userTable } from "../../db/schema.js";
import { fromDbTimestampOrNull, toDbTimestamp } from "./timestamp.js";
import { trackCreatedUsers } from "./test-helpers.js";

const { mockPreApprovalGet, mockPreApprovalCreate, mockPreApprovalUpdate } = vi.hoisted(() => ({
  mockPreApprovalGet: vi.fn(),
  mockPreApprovalCreate: vi.fn(),
  mockPreApprovalUpdate: vi.fn(),
}));

// Mock parcial: só PreApproval (evita chamada real à API do MercadoPago).
vi.mock("mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("mercadopago")>()),
  PreApproval: class {
    get = mockPreApprovalGet;
    create = mockPreApprovalCreate;
    update = mockPreApprovalUpdate;
  },
}));

const { billingService } = await import("../index.js");
const { BillingUserNotFoundError } = await import("../../core/billing/index.js");
// markConversionReported só é alcançado por billingService via o dep opcional
// `conversions` (Google Ads), não configurado no ambiente de teste — testado
// direto contra o repo em vez de via serviço composto, exceção ao padrão dos
// demais testes deste arquivo.
const { drizzleBillingRepo } = await import("./billing-repo.js");

const trackUser = trackCreatedUsers();

async function seedUser(opts: Partial<{
  plan: string;
  planExpiresAt: Date;
  mpSubscriptionId: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  conversionReportedAt: Date;
}> = {}) {
  const { planExpiresAt, conversionReportedAt, ...rest } = opts;
  const [user] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Billing User",
      email: `billing-${crypto.randomUUID()}@example.com`,
      ...rest,
      planExpiresAt: planExpiresAt ? toDbTimestamp(planExpiresAt) : undefined,
      conversionReportedAt: conversionReportedAt ? toDbTimestamp(conversionReportedAt) : undefined,
    })
    .returning();
  trackUser(user.id);
  return { ...user, planExpiresAt: fromDbTimestampOrNull(user.planExpiresAt) };
}

beforeEach(() => {
  vi.stubEnv("DISCORD_WEBHOOK_URL", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  await db.delete(planConfig).where(eq(planConfig.id, "default"));
});

describe("getPlanConfig", () => {
  it("cria a linha default (14.9/119.9) se ainda não existe", async () => {
    const config = await billingService.getPlanConfig();

    expect(config).toMatchObject({ id: "default", monthlyAmount: 14.9, annualAmount: 119.9 });
    const [inDb] = await db.select().from(planConfig).where(eq(planConfig.id, "default"));
    expect(inDb).toMatchObject({ monthlyAmount: 14.9, annualAmount: 119.9 });
  });

  it("é idempotente: não sobrescreve valores já customizados", async () => {
    await billingService.updatePlanConfig({ monthlyAmount: 19.9, annualAmount: 199.9 });

    const config = await billingService.getPlanConfig();

    expect(config).toMatchObject({ monthlyAmount: 19.9, annualAmount: 199.9 });
  });
});

describe("updatePlanConfig", () => {
  it("persiste novos valores e atualiza updatedAt", async () => {
    const before = await billingService.getPlanConfig();

    const updated = await billingService.updatePlanConfig({ monthlyAmount: 24.9, annualAmount: 249.9 });

    expect(updated).toMatchObject({ monthlyAmount: 24.9, annualAmount: 249.9 });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    const [inDb] = await db.select().from(planConfig).where(eq(planConfig.id, "default"));
    expect(inDb).toMatchObject({ monthlyAmount: 24.9, annualAmount: 249.9 });
  });
});

describe("getSubscription", () => {
  it("retorna shape default free para usuário inexistente", async () => {
    const sub = await billingService.getSubscription(crypto.randomUUID());

    expect(sub).toEqual({ plan: "free", planExpiresAt: null, mpSubscriptionId: null });
  });

  it("retorna plan/planExpiresAt/mpSubscriptionId do usuário existente", async () => {
    const expiresAt = new Date(Date.now() + 86_400_000);
    const user = await seedUser({ plan: "pro", planExpiresAt: expiresAt, mpSubscriptionId: "sub-x" });

    const sub = await billingService.getSubscription(user.id);

    expect(sub.plan).toBe("pro");
    expect(sub.mpSubscriptionId).toBe("sub-x");
    expect(sub.planExpiresAt?.getTime()).toBe(expiresAt.getTime());
  });
});

describe("checkout", () => {
  it("captura o click id quando o usuário ainda não tem atribuição", async () => {
    const user = await seedUser();
    mockPreApprovalCreate.mockResolvedValue({ init_point: "https://mp/init" });

    await billingService.checkout({
      userId: user.id,
      email: user.email,
      cycle: "monthly",
      origin: "https://bfin.app",
      click: { gclid: "click-1" },
    });

    const [inDb] = await db.select().from(userTable).where(eq(userTable.id, user.id));
    expect(inDb.gclid).toBe("click-1");
  });

  it("não sobrescreve atribuição prévia", async () => {
    const user = await seedUser({ gclid: "click-original" });
    mockPreApprovalCreate.mockResolvedValue({ init_point: "https://mp/init" });

    await billingService.checkout({
      userId: user.id,
      email: user.email,
      cycle: "monthly",
      origin: "https://bfin.app",
      click: { gclid: "click-novo" },
    });

    const [inDb] = await db.select().from(userTable).where(eq(userTable.id, user.id));
    expect(inDb.gclid).toBe("click-original");
  });
});

describe("Billing repo not found", () => {
  it("clearSubscription rejeita userId inexistente com erro tipado", async () => {
    await expect(drizzleBillingRepo.clearSubscription(crypto.randomUUID())).rejects.toBeInstanceOf(
      BillingUserNotFoundError
    );
  });

  it("activatePro rejeita userId inexistente com erro tipado", async () => {
    await expect(
      drizzleBillingRepo.activatePro(crypto.randomUUID(), new Date(), "sub-missing")
    ).rejects.toBeInstanceOf(BillingUserNotFoundError);
  });

  it("markConversionReported rejeita userId inexistente com erro tipado", async () => {
    await expect(
      drizzleBillingRepo.markConversionReported(crypto.randomUUID())
    ).rejects.toBeInstanceOf(BillingUserNotFoundError);
  });
});

describe("cancelSubscription", () => {
  it("desvincula mpSubscriptionId sem mudar o plan", async () => {
    const user = await seedUser({ plan: "pro", mpSubscriptionId: "sub-1" });
    mockPreApprovalUpdate.mockResolvedValue({});

    await billingService.cancelSubscription(user.id);

    const [inDb] = await db.select().from(userTable).where(eq(userTable.id, user.id));
    expect(inDb.mpSubscriptionId).toBeNull();
    expect(inDb.plan).toBe("pro");
  });
});

describe("processSubscriptionEvent", () => {
  it("authorized ativa o pro: plan, planExpiresAt e mpSubscriptionId", async () => {
    const user = await seedUser({ plan: "free" });
    mockPreApprovalGet.mockResolvedValue({
      id: "sub-2",
      status: "authorized",
      external_reference: `${user.id}:monthly`,
    });

    await billingService.processSubscriptionEvent("sub-2");

    const [inDb] = await db.select().from(userTable).where(eq(userTable.id, user.id));
    expect(inDb.plan).toBe("pro");
    expect(inDb.mpSubscriptionId).toBe("sub-2");
    expect(inDb.planExpiresAt).not.toBeNull();
  });

  it("cancelled desvincula a assinatura", async () => {
    const user = await seedUser({ plan: "pro", mpSubscriptionId: "sub-3" });
    mockPreApprovalGet.mockResolvedValue({
      id: "sub-3",
      status: "cancelled",
      external_reference: `${user.id}:monthly`,
    });

    await billingService.processSubscriptionEvent("sub-3");

    const [inDb] = await db.select().from(userTable).where(eq(userTable.id, user.id));
    expect(inDb.mpSubscriptionId).toBeNull();
  });

  it("cancelled com userId inexistente rejeita (fail-closed, mesmo comportamento do P2025 do Prisma)", async () => {
    mockPreApprovalGet.mockResolvedValue({
      id: "sub-4",
      status: "cancelled",
      external_reference: `${crypto.randomUUID()}:monthly`,
    });

    await expect(billingService.processSubscriptionEvent("sub-4")).rejects.toThrow("not found");
  });
});

describe("markConversionReported", () => {
  it("marca conversionReportedAt do usuário existente", async () => {
    const user = await seedUser();

    await drizzleBillingRepo.markConversionReported(user.id);

    const [inDb] = await db.select().from(userTable).where(eq(userTable.id, user.id));
    expect(inDb.conversionReportedAt).not.toBeNull();
  });

  it("rejeita para userId inexistente (fail-closed, mesmo comportamento do P2025 do Prisma)", async () => {
    await expect(
      drizzleBillingRepo.markConversionReported(crypto.randomUUID())
    ).rejects.toBeInstanceOf(BillingUserNotFoundError);
  });
});
