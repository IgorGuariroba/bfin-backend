import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { previsao, transaction } from "../../db/schema.js";
import type { InsightsRepo, MovementRange } from "../../core/insights/index.js";
import { fromDbTimestamp, toDbTimestamp } from "./timestamp.js";

function rangeConditions(range: MovementRange) {
  const conditions = [lt(transaction.date, toDbTimestamp(range.lt))];
  if (range.gte) conditions.push(gte(transaction.date, toDbTimestamp(range.gte)));
  return conditions;
}

export const drizzleInsightsRepo: InsightsRepo = {
  sumByType: async (userId, range) => {
    const rows = await db
      .select({ type: transaction.type, total: sql<number>`sum(${transaction.amount})` })
      .from(transaction)
      .where(and(eq(transaction.userId, userId), ...rangeConditions(range)))
      .groupBy(transaction.type);

    const byType: Record<string, number> = {};
    for (const r of rows) byType[r.type] = Number(r.total);
    return byType;
  },

  listMovements: async (userId, range) => {
    const rows = await db
      .select({ type: transaction.type, amount: transaction.amount, date: transaction.date })
      .from(transaction)
      .where(and(eq(transaction.userId, userId), ...rangeConditions(range)))
      .orderBy(asc(transaction.date));

    return rows.map((r) => ({ type: r.type, amount: r.amount, date: fromDbTimestamp(r.date) }));
  },

  sumPrevisoes: async (userId) => {
    const [row] = await db
      .select({ total: sql<number>`sum(${previsao.amount})` })
      .from(previsao)
      .where(eq(previsao.userId, userId));
    return Number(row?.total ?? 0);
  },
};
