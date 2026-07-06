import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../lib/drizzle.js";
import { planConfig, user as userTable } from "../db/schema.js";
import { trackCreatedUsers } from "../adapters/drizzle/test-helpers.js";

const { mockPreApprovalGet, mockPreApprovalCreate, mockPreApprovalUpdate } =
  vi.hoisted(() => ({
    mockPreApprovalGet: vi.fn(),
    mockPreApprovalCreate: vi.fn(),
    mockPreApprovalUpdate: vi.fn(),
  }));

vi.mock("mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("mercadopago")>()),
  PreApproval: class {
    get = mockPreApprovalGet;
    create = mockPreApprovalCreate;
    update = mockPreApprovalUpdate;
  },
}));

const { buildApp } = await import("../app.js");

const SECRET = "test-internal-secret";
const trackUser = trackCreatedUsers();

async function seedUser(
  opts: Partial<{ plan: string; mpSubscriptionId: string }> = {},
) {
  const [user] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Billing Route User",
      email: `billing-route-${crypto.randomUUID()}@example.com`,
      ...opts,
    })
    .returning();
  trackUser(user.id);
  return user;
}

beforeEach(() => {
  vi.stubEnv("INTERNAL_API_SECRET", SECRET);
  vi.stubEnv("DISCORD_WEBHOOK_URL", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  await db.delete(planConfig).where(eq(planConfig.id, "default"));
});

describe("autenticação interna", () => {
  it("rejeita sem x-internal-secret com 401", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/billing/plan-prices",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /billing/plan-prices", () => {
  it("expõe monthly/annual do PlanConfig", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/billing/plan-prices",
      headers: { "x-internal-secret": SECRET },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ monthly: 14.9, annual: 119.9 });
  });
});

describe("GET/PUT /billing/plan-config", () => {
  it("GET devolve a config completa", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/billing/plan-config",
      headers: { "x-internal-secret": SECRET },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: "default",
      monthlyAmount: 14.9,
      annualAmount: 119.9,
    });
  });

  it("PUT atualiza e 400 em valores inválidos", async () => {
    const app = buildApp();
    const ok = await app.inject({
      method: "PUT",
      url: "/billing/plan-config",
      headers: { "x-internal-secret": SECRET },
      payload: { monthlyAmount: 19.9, annualAmount: 199.9 },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      monthlyAmount: 19.9,
      annualAmount: 199.9,
    });

    const bad = await app.inject({
      method: "PUT",
      url: "/billing/plan-config",
      headers: { "x-internal-secret": SECRET },
      payload: { monthlyAmount: "x", annualAmount: 199.9 },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe("GET/DELETE /billing/subscription", () => {
  it("GET devolve free default pra usuário sem assinatura", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/billing/subscription?userId=${crypto.randomUUID()}`,
      headers: { "x-internal-secret": SECRET },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      plan: "free",
      planExpiresAt: null,
      mpSubscriptionId: null,
    });
  });

  it("DELETE cancela no gateway e 400 sem assinatura ativa", async () => {
    const app = buildApp();
    const user = await seedUser({ plan: "pro", mpSubscriptionId: "sub-1" });
    mockPreApprovalUpdate.mockResolvedValue({});

    const ok = await app.inject({
      method: "DELETE",
      url: "/billing/subscription",
      headers: { "x-internal-secret": SECRET },
      payload: { userId: user.id },
    });
    expect(ok.statusCode).toBe(200);

    const bad = await app.inject({
      method: "DELETE",
      url: "/billing/subscription",
      headers: { "x-internal-secret": SECRET },
      payload: { userId: user.id },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe("POST /billing/checkout", () => {
  it("devolve initPoint do gateway", async () => {
    const app = buildApp();
    const user = await seedUser();
    mockPreApprovalCreate.mockResolvedValue({ init_point: "https://mp/init" });

    const res = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: { "x-internal-secret": SECRET },
      payload: {
        userId: user.id,
        email: user.email,
        cycle: "monthly",
        origin: "https://bfin.app",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ initPoint: "https://mp/init" });
  });

  it("400 em ciclo inválido", async () => {
    const app = buildApp();
    const user = await seedUser();

    const res = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: { "x-internal-secret": SECRET },
      payload: {
        userId: user.id,
        email: user.email,
        cycle: "weekly",
        origin: "https://bfin.app",
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
