import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { planConfig, user } from "../../db/schema.js";
import { BillingUserNotFoundError, type BillingRepo } from "../../core/billing/index.js";
import { fromDbTimestamp, fromDbTimestampOrNull, toDbTimestamp } from "./timestamp.js";

const DEFAULT_CONFIG = { id: "default", monthlyAmount: 14.9, annualAmount: 119.9 };

export const drizzleBillingRepo: BillingRepo = {
  getPlanConfig: async () => {
    // Upsert no-op: garante a linha default sem sobrescrever valores já
    // customizados (equivalente ao `update: {}` do upsert Prisma).
    const [row] = await db
      .insert(planConfig)
      .values({ ...DEFAULT_CONFIG, updatedAt: toDbTimestamp(new Date()) })
      .onConflictDoUpdate({ target: planConfig.id, set: { id: sql`excluded.id` } })
      .returning();
    return { ...row, updatedAt: fromDbTimestamp(row.updatedAt) };
  },

  updatePlanConfig: async (monthlyAmount, annualAmount) => {
    const updatedAt = toDbTimestamp(new Date());
    const [row] = await db
      .insert(planConfig)
      .values({ id: "default", monthlyAmount, annualAmount, updatedAt })
      .onConflictDoUpdate({
        target: planConfig.id,
        set: { monthlyAmount, annualAmount, updatedAt },
      })
      .returning();
    return { ...row, updatedAt: fromDbTimestamp(row.updatedAt) };
  },

  findSubscription: async (userId) => {
    const [row] = await db
      .select({ plan: user.plan, planExpiresAt: user.planExpiresAt, mpSubscriptionId: user.mpSubscriptionId })
      .from(user)
      .where(eq(user.id, userId));
    if (!row) return null;
    return { ...row, planExpiresAt: fromDbTimestampOrNull(row.planExpiresAt) };
  },

  clearSubscription: async (userId) => {
    // Guard espelha o P2025 do Prisma em update de linha inexistente (mesmo
    // padrão de drizzle/identity-repo.ts).
    const updated = await db
      .update(user)
      .set({ mpSubscriptionId: null })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (updated.length === 0) throw new BillingUserNotFoundError(`User ${userId} not found`);
  },

  activatePro: async (userId, planExpiresAt, mpSubscriptionId) => {
    const updated = await db
      .update(user)
      .set({ plan: "pro", planExpiresAt: toDbTimestamp(planExpiresAt), mpSubscriptionId })
      .where(eq(user.id, userId))
      .returning({ email: user.email, gclid: user.gclid, gbraid: user.gbraid, wbraid: user.wbraid });
    if (updated.length === 0) throw new BillingUserNotFoundError(`User ${userId} not found`);
    return updated[0];
  },

  captureClickAttribution: async (userId, click) => {
    await db
      .update(user)
      .set(click)
      .where(
        and(eq(user.id, userId), isNull(user.gclid), isNull(user.gbraid), isNull(user.wbraid))
      );
  },

  conversionAlreadyReported: async (userId) => {
    const [row] = await db
      .select({ conversionReportedAt: user.conversionReportedAt })
      .from(user)
      .where(eq(user.id, userId));
    return row?.conversionReportedAt != null;
  },

  markConversionReported: async (userId) => {
    const updated = await db
      .update(user)
      .set({ conversionReportedAt: toDbTimestamp(new Date()) })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (updated.length === 0) throw new BillingUserNotFoundError(`User ${userId} not found`);
  },
};
