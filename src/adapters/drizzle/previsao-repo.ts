import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { previsao, transaction, user } from "../../db/schema.js";
import { PrevisaoNotFoundError, type PrevisaoRepo } from "../../core/previsao/index.js";
import { newId } from "./id.js";
import { fromDbTimestampOrNull, toDbTimestamp } from "./timestamp.js";

// IDs novos nascem como UUID (crypto.randomUUID), não cuid — mesma convenção
// do drizzleTagRepo: a coluna é `text` sem formato imposto pelo Postgres.
export const drizzlePrevisaoRepo: PrevisaoRepo = {
  listByUser: (userId) =>
    db.select().from(previsao).where(eq(previsao.userId, userId)).orderBy(asc(previsao.name)),

  create: async (data) => {
    const [row] = await db
      .insert(previsao)
      .values({ id: newId(), ...data })
      .returning();
    return row;
  },

  findById: async (id) => {
    const [row] = await db.select().from(previsao).where(eq(previsao.id, id));
    return row ?? null;
  },

  update: async (id, patch) => {
    // Guards espelham o P2025 do Prisma (row sumiu entre findById e update, ou
    // patch vazio): sem eles, Drizzle retorna undefined silenciosamente ou
    // lança "No values to set" (mapUpdateSet em set({})), quebrando o 404
    // limpo que o service já garante via PrevisaoNotFoundError.
    if (Object.keys(patch).length === 0) {
      const [existing] = await db.select().from(previsao).where(eq(previsao.id, id));
      if (!existing) throw new PrevisaoNotFoundError(`Previsao ${id} not found`);
      return existing;
    }
    const [row] = await db.update(previsao).set(patch).where(eq(previsao.id, id)).returning();
    if (!row) throw new PrevisaoNotFoundError(`Previsao ${id} not found`);
    return row;
  },

  delete: async (id) => {
    const deleted = await db.delete(previsao).where(eq(previsao.id, id)).returning({ id: previsao.id });
    if (deleted.length === 0) throw new PrevisaoNotFoundError(`Previsao ${id} not found`);
  },

  deleteManualDiario: async (userId, window) => {
    await db
      .delete(transaction)
      .where(
        and(
          eq(transaction.userId, userId),
          eq(transaction.type, "diario"),
          eq(transaction.source, "manual"),
          gte(transaction.date, toDbTimestamp(window.gte)),
          lt(transaction.date, toDbTimestamp(window.lt))
        )
      );
  },

  createDiarios: async (rows) => {
    if (rows.length === 0) return;
    const now = toDbTimestamp(new Date());
    // type e source ficam explícitos/no default do schema ("manual"), como no
    // adapter Prisma.
    await db.insert(transaction).values(
      rows.map((row) => ({
        id: newId(),
        userId: row.userId,
        type: "diario",
        description: row.description,
        amount: row.amount,
        date: toDbTimestamp(row.date),
        updatedAt: now,
      }))
    );
  },

  listAutoBaixaCandidates: async () => {
    const rows = await db
      .select({
        userId: user.id,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
      })
      .from(user)
      .where(eq(user.autoBaixaDiario, true));
    return rows.map((row) => ({
      userId: row.userId,
      plan: row.plan,
      planExpiresAt: fromDbTimestampOrNull(row.planExpiresAt),
    }));
  },

  deleteManualDiarioForUsers: async (userIds, window) => {
    const deleted = await db
      .delete(transaction)
      .where(
        and(
          eq(transaction.type, "diario"),
          eq(transaction.source, "manual"),
          gte(transaction.date, toDbTimestamp(window.gte)),
          lt(transaction.date, toDbTimestamp(window.lt)),
          inArray(transaction.userId, userIds)
        )
      )
      .returning({ id: transaction.id });
    return deleted.length;
  },
};
