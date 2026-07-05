import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { apiKey } from "../../db/schema.js";
import { ApiKeyNotFoundError, type ApiKeyRepo } from "../../core/apikeys/index.js";
import { newId } from "./id.js";
import { fromDbTimestamp, fromDbTimestampOrNull, toDbTimestamp } from "./timestamp.js";

export const drizzleApiKeyRepo: ApiKeyRepo = {
  listByUser: async (userId) => {
    const rows = await db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        revokedAt: apiKey.revokedAt,
      })
      .from(apiKey)
      .where(eq(apiKey.userId, userId))
      .orderBy(desc(apiKey.createdAt));

    return rows.map((r) => ({
      ...r,
      lastUsedAt: fromDbTimestampOrNull(r.lastUsedAt),
      createdAt: fromDbTimestamp(r.createdAt),
      revokedAt: fromDbTimestampOrNull(r.revokedAt),
    }));
  },

  revokeAllActive: async (userId, at) => {
    await db
      .update(apiKey)
      .set({ revokedAt: toDbTimestamp(at) })
      .where(and(eq(apiKey.userId, userId), isNull(apiKey.revokedAt)));
  },

  create: async (data) => {
    const [row] = await db
      .insert(apiKey)
      .values({ id: newId(), ...data })
      .returning({ id: apiKey.id, prefix: apiKey.prefix, name: apiKey.name, createdAt: apiKey.createdAt });
    return { ...row, createdAt: fromDbTimestamp(row.createdAt) };
  },

  findOwned: async (userId, id) => {
    const [row] = await db
      .select({ id: apiKey.id, revokedAt: apiKey.revokedAt })
      .from(apiKey)
      .where(and(eq(apiKey.id, id), eq(apiKey.userId, userId)))
      .limit(1);
    if (!row) return null;
    return { id: row.id, revokedAt: fromDbTimestampOrNull(row.revokedAt) };
  },

  revoke: async (id, at) => {
    // Guard espelha o P2025 do Prisma em update de linha inexistente (mesmo
    // padrão de drizzle/previsao-repo.ts).
    const updated = await db
      .update(apiKey)
      .set({ revokedAt: toDbTimestamp(at) })
      .where(eq(apiKey.id, id))
      .returning({ id: apiKey.id });
    if (updated.length === 0) throw new ApiKeyNotFoundError(`ApiKey ${id} not found`);
  },

  findByHashedKey: async (hashedKey) => {
    const [row] = await db
      .select({ id: apiKey.id, userId: apiKey.userId, revokedAt: apiKey.revokedAt })
      .from(apiKey)
      .where(eq(apiKey.hashedKey, hashedKey));
    if (!row) return null;
    return { id: row.id, userId: row.userId, revokedAt: fromDbTimestampOrNull(row.revokedAt) };
  },

  bumpLastUsed: async (id, at) => {
    const updated = await db
      .update(apiKey)
      .set({ lastUsedAt: toDbTimestamp(at) })
      .where(eq(apiKey.id, id))
      .returning({ id: apiKey.id });
    if (updated.length === 0) throw new ApiKeyNotFoundError(`ApiKey ${id} not found`);
  },
};
