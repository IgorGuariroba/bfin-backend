import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../lib/drizzle.js";
import { transaction, user as userTable } from "../db/schema.js";
import { toDbTimestamp } from "../adapters/drizzle/timestamp.js";
import { trackCreatedUsers } from "../adapters/drizzle/test-helpers.js";
import { saoPauloTodayRange } from "../core/dates.js";
import { buildApp } from "../app.js";

const trackUser = trackCreatedUsers();
const SECRET = "test-secret";

/** Data dentro da janela de hoje em São Paulo (meio-dia, como o app grava o diário). */
function todayInside(): Date {
  const { gte } = saoPauloTodayRange();
  return new Date(gte.getTime() + 12 * 60 * 60 * 1000);
}

async function makeUser(opts: { plan: string; autoBaixaDiario: boolean; planExpiresAt?: Date }) {
  const [row] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Cron User",
      email: `cron-${crypto.randomUUID()}@example.com`,
      plan: opts.plan,
      autoBaixaDiario: opts.autoBaixaDiario,
      planExpiresAt: opts.planExpiresAt ? toDbTimestamp(opts.planExpiresAt) : undefined,
    })
    .returning();
  trackUser(row.id);
  return row;
}

async function makeDiario(userId: string, date: Date, source?: string) {
  const now = toDbTimestamp(new Date());
  const [row] = await db
    .insert(transaction)
    .values({
      id: crypto.randomUUID(),
      userId,
      type: "diario",
      description: "Previsão Diária",
      amount: 300,
      date: toDbTimestamp(date),
      source: source ?? "manual",
      updatedAt: now,
    })
    .returning();
  return row;
}

async function findTx(id: string) {
  const [row] = await db.select().from(transaction).where(eq(transaction.id, id));
  return row ?? null;
}

describe("POST /previsao/baixa-diaria", () => {
  let originalSecret: string | undefined;

  beforeAll(() => {
    originalSecret = process.env.INTERNAL_API_SECRET;
    process.env.INTERNAL_API_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.INTERNAL_API_SECRET = originalSecret;
  });

  function post() {
    const app = buildApp();
    return app.inject({
      method: "POST",
      url: "/previsao/baixa-diaria",
      headers: { "x-internal-secret": SECRET },
    });
  }

  it("rejeita sem o header do segredo compartilhado", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "POST", url: "/previsao/baixa-diaria" });
    expect(response.statusCode).toBe(401);
  });

  it("apaga o diário de hoje de um usuário pro com a flag ligada", async () => {
    const user = await makeUser({ plan: "pro", autoBaixaDiario: true });
    const diario = await makeDiario(user.id, todayInside());

    const res = await post();
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(await findTx(diario.id)).toBeNull();
  });

  it("preserva o diário futuro (só apaga o de hoje)", async () => {
    const user = await makeUser({ plan: "pro", autoBaixaDiario: true });
    const { lt } = saoPauloTodayRange();
    const amanha = new Date(lt.getTime() + 12 * 60 * 60 * 1000);
    const futuro = await makeDiario(user.id, amanha);

    await post();

    expect(await findTx(futuro.id)).not.toBeNull();
  });

  it("preserva o diário de quem não optou (free e pro com flag desligada)", async () => {
    const free = await makeUser({ plan: "free", autoBaixaDiario: true });
    const proOff = await makeUser({ plan: "pro", autoBaixaDiario: false });
    const dFree = await makeDiario(free.id, todayInside());
    const dProOff = await makeDiario(proOff.id, todayInside());

    await post();

    expect(await findTx(dFree.id)).not.toBeNull();
    expect(await findTx(dProOff.id)).not.toBeNull();
  });

  it("não toca em outros tipos (saida) de hoje, mesmo de pro com flag ligada", async () => {
    const user = await makeUser({ plan: "pro", autoBaixaDiario: true });
    const now = toDbTimestamp(new Date());
    const [saida] = await db
      .insert(transaction)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        type: "saida",
        description: "Mercado",
        amount: 400,
        date: toDbTimestamp(todayInside()),
        updatedAt: now,
      })
      .returning();

    await post();

    expect(await findTx(saida.id)).not.toBeNull();
  });

  it("preserva diário importado do Open Finance (source != manual)", async () => {
    const user = await makeUser({ plan: "pro", autoBaixaDiario: true });
    const importado = await makeDiario(user.id, todayInside(), "pluggy");

    await post();

    expect(await findTx(importado.id)).not.toBeNull();
  });

  it("preserva o diário de um pro com plano vencido (planExpiresAt no passado)", async () => {
    const user = await makeUser({
      plan: "pro",
      autoBaixaDiario: true,
      planExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const diario = await makeDiario(user.id, todayInside());

    await post();

    expect(await findTx(diario.id)).not.toBeNull();
  });
});
