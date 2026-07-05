import { afterEach, describe, it, expect, vi } from "vitest";
import { db } from "../lib/drizzle.js";
import { transaction, user as userTable } from "../db/schema.js";
import { toDbTimestamp } from "../adapters/drizzle/timestamp.js";
import { trackCreatedUsers } from "../adapters/drizzle/test-helpers.js";
import { buildApp } from "../app.js";

const SECRET = "test-internal-secret";
const trackUser = trackCreatedUsers();

async function seedUser() {
  const [user] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Insights Route User",
      email: `insights-route-${crypto.randomUUID()}@example.com`,
      plan: "pro",
    })
    .returning();
  trackUser(user.id);
  return user;
}

function tx(userId: string, type: string, amount: number, date: Date) {
  return db.insert(transaction).values({
    id: crypto.randomUUID(),
    userId,
    type,
    description: type,
    amount,
    date: toDbTimestamp(date),
    source: "manual",
    updatedAt: toDbTimestamp(new Date()),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("autenticação interna", () => {
  it("rejeita sem x-internal-secret com 401", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/insights/totais?userId=x&month=2026-06" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /insights/totais", () => {
  it("devolve os totais do mês", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);
    const app = buildApp();
    const user = await seedUser();
    await tx(user.id, "entrada", 5000, new Date(2026, 5, 1, 12));
    await tx(user.id, "saida", 800, new Date(2026, 5, 5, 12));

    const res = await app.inject({
      method: "GET",
      url: `/insights/totais?userId=${user.id}&month=2026-06`,
      headers: { "x-internal-secret": SECRET },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ entradas: 5000, saidas: 800 });
  });

  it("400 em mês malformado", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);
    const app = buildApp();
    const user = await seedUser();

    const res = await app.inject({
      method: "GET",
      url: `/insights/totais?userId=${user.id}&month=2026/06`,
      headers: { "x-internal-secret": SECRET },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /insights/saldos", () => {
  it("devolve a evolução diária do saldo", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);
    const app = buildApp();
    const user = await seedUser();
    await tx(user.id, "entrada", 1000, new Date(2026, 5, 2, 12));

    const res = await app.inject({
      method: "GET",
      url: `/insights/saldos?userId=${user.id}&month=2026-06`,
      headers: { "x-internal-secret": SECRET },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().entries).toHaveLength(30);
  });
});

describe("GET /insights/month-summary", () => {
  it("resume o mês", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);
    const app = buildApp();
    const user = await seedUser();
    await tx(user.id, "entrada", 5000, new Date(2026, 5, 1, 12));
    await tx(user.id, "saida", 800, new Date(2026, 5, 5, 12));

    const res = await app.inject({
      method: "GET",
      url: `/insights/month-summary?userId=${user.id}&month=2026-06`,
      headers: { "x-internal-secret": SECRET },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ month: "2026-06", sobrouNoMes: 4200 });
  });
});

describe("GET /insights/sugestoes", () => {
  it("aponta saldo negativo", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);
    const app = buildApp();
    const user = await seedUser();
    await tx(user.id, "entrada", 100, new Date(2026, 5, 1, 12));
    await tx(user.id, "saida", 900, new Date(2026, 5, 2, 12));

    const res = await app.inject({
      method: "GET",
      url: `/insights/sugestoes?userId=${user.id}&month=2026-06`,
      headers: { "x-internal-secret": SECRET },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ tipo: string }>;
    expect(body.map((s) => s.tipo)).toContain("saldo_negativo");
  });
});
