import { and, eq } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { accountMember, user } from "../../db/schema.js";
import { IdentityUserNotFoundError, type IdentityRepo } from "../../core/identity/index.js";
import { fromDbTimestampOrNull } from "./timestamp.js";

export const drizzleIdentityRepo: IdentityRepo = {
  findPlanInfo: async (userId) => {
    const [row] = await db
      .select({ plan: user.plan, planExpiresAt: user.planExpiresAt })
      .from(user)
      .where(eq(user.id, userId));
    if (!row) return null;
    return { plan: row.plan, planExpiresAt: fromDbTimestampOrNull(row.planExpiresAt) };
  },

  setPlanFree: async (userId) => {
    // Guard espelha o P2025 do Prisma em update de linha inexistente (mesmo
    // padrão de drizzle/previsao-repo.ts) — sem ele, um userId inválido vira
    // no-op silencioso em vez de erro.
    const updated = await db
      .update(user)
      .set({ plan: "free" })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (updated.length === 0) throw new IdentityUserNotFoundError(`User ${userId} not found`);
  },

  setAutoBaixaDiario: async (userId, enabled) => {
    const updated = await db
      .update(user)
      .set({ autoBaixaDiario: enabled })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (updated.length === 0) throw new IdentityUserNotFoundError(`User ${userId} not found`);
  },

  findActiveMembershipOwner: async (ownerId, memberId) => {
    const [row] = await db
      .select({ name: user.name, email: user.email })
      .from(accountMember)
      .innerJoin(user, eq(user.id, accountMember.ownerId))
      .where(
        and(
          eq(accountMember.ownerId, ownerId),
          eq(accountMember.memberId, memberId),
          eq(accountMember.status, "active")
        )
      )
      .limit(1);
    return row ?? null;
  },
};
