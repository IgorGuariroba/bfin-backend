import { describe, it, expect } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { previsao, transaction, user as userTable } from "../../db/schema.js";
import { toDbTimestamp } from "./timestamp.js";
import { previsaoService } from "../index.js";
import { PrevisaoNotFoundError } from "../../core/previsao/index.js";
import { drizzlePrevisaoRepo } from "./previsao-repo.js";
import { trackCreatedUsers } from "./test-helpers.js";

const trackUser = trackCreatedUsers();

async function seedUser() {
  const [row] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Previsao User",
      email: `previsao-${crypto.randomUUID()}@example.com`,
      plan: "pro",
    })
    .returning();
  trackUser(row.id);
  return row;
}

describe("previsao-service CRUD", () => {
  it("cria, lista em ordem de name, atualiza e deleta", async () => {
    const user = await seedUser();

    await previsaoService.createPrevisao({ userId: user.id, name: "Uber", amount: 200 });
    const mercado = await previsaoService.createPrevisao({
      userId: user.id,
      name: "Mercado",
      amount: 800,
    });

    const listed = await previsaoService.listPrevisoes(user.id);
    expect(listed.map((p) => p.name)).toEqual(["Mercado", "Uber"]);

    const updated = await previsaoService.updatePrevisao({
      userId: user.id,
      id: mercado.id,
      amount: 900,
    });
    expect(updated).toMatchObject({ name: "Mercado", amount: 900 });

    await previsaoService.deletePrevisao(user.id, mercado.id);
    expect((await db.select().from(previsao).where(eq(previsao.id, mercado.id)))[0]).toBeUndefined();
  });

  it("não deixa editar previsão de outro dono (not found)", async () => {
    const dono = await seedUser();
    const invasor = await seedUser();
    const prev = await previsaoService.createPrevisao({
      userId: dono.id,
      name: "Mercado",
      amount: 800,
    });

    await expect(
      previsaoService.updatePrevisao({ userId: invasor.id, id: prev.id, amount: 1 })
    ).rejects.toThrow(PrevisaoNotFoundError);
  });

  it("update/delete no repo direto rejeitam com PrevisaoNotFoundError para id inexistente", async () => {
    const id = crypto.randomUUID();

    await expect(drizzlePrevisaoRepo.update(id, { amount: 1 })).rejects.toBeInstanceOf(
      PrevisaoNotFoundError
    );
    await expect(drizzlePrevisaoRepo.delete(id)).rejects.toBeInstanceOf(PrevisaoNotFoundError);
  });
});

describe("previsao-service applyPrevisao", () => {
  it("materializa a projeção: um diario manual ao meio-dia por dia na janela de 12 meses", async () => {
    const user = await seedUser();

    const { count } = await previsaoService.applyPrevisao({ userId: user.id, amount: 150 });

    const stored = await db
      .select()
      .from(transaction)
      .where(and(eq(transaction.userId, user.id), eq(transaction.type, "diario")))
      .orderBy(asc(transaction.date));
    expect(stored).toHaveLength(count);
    expect(count).toBeGreaterThanOrEqual(365);
    expect(stored[0]).toMatchObject({
      description: "Previsão Diária",
      amount: 150,
      source: "manual",
    });
  });

  it("recria os diario manuais da janela mas preserva importados (source=pluggy)", async () => {
    const user = await seedUser();
    const emUmMes = new Date();
    emUmMes.setMonth(emUmMes.getMonth() + 1);
    const now = toDbTimestamp(new Date());

    const [manualAntigo] = await db
      .insert(transaction)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        type: "diario",
        description: "Previsão Diária",
        amount: 99,
        date: toDbTimestamp(emUmMes),
        updatedAt: now,
      })
      .returning();
    const [importado] = await db
      .insert(transaction)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        type: "diario",
        source: "pluggy",
        description: "Previsão Diária",
        amount: 99,
        date: toDbTimestamp(emUmMes),
        updatedAt: now,
      })
      .returning();

    await previsaoService.applyPrevisao({ userId: user.id, amount: 150 });

    expect(
      (await db.select().from(transaction).where(eq(transaction.id, manualAntigo.id)))[0]
    ).toBeUndefined();
    expect(
      (await db.select().from(transaction).where(eq(transaction.id, importado.id)))[0]
    ).not.toBeUndefined();
  });
});
