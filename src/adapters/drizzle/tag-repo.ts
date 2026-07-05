import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { tag } from "../../db/schema.js";
import type { TagRepo } from "../../core/tags/index.js";
import { newId } from "./id.js";

// IDs novos nascem como UUID (crypto.randomUUID), não mais cuid (o default do
// Prisma era gerado client-side, não é um DEFAULT do Postgres — a coluna é
// `text` sem formato imposto). Tags já existentes continuam em cuid; nenhuma
// rota/validação depende do formato do id, só da unicidade.
export const drizzleTagRepo: TagRepo = {
  findById: async (id) => {
    const [row] = await db.select().from(tag).where(eq(tag.id, id));
    return row ?? null;
  },

  findByName: async (userId, name) => {
    const [row] = await db
      .select()
      .from(tag)
      .where(and(eq(tag.userId, userId), eq(tag.name, name)));
    return row ?? null;
  },

  listByUser: (userId) =>
    db
      .select()
      .from(tag)
      .where(eq(tag.userId, userId))
      .orderBy(desc(tag.isSystem), asc(tag.name)),

  listSystemNames: async (userId) => {
    const rows = await db
      .select({ name: tag.name })
      .from(tag)
      .where(and(eq(tag.userId, userId), eq(tag.isSystem, true)));
    return rows.map((r) => r.name);
  },

  create: async (data) => {
    const [row] = await db
      .insert(tag)
      .values({ id: newId(), ...data })
      .returning();
    return row;
  },

  createSystemTags: async (userId, tags) => {
    if (tags.length === 0) return;
    await db
      .insert(tag)
      .values(
        tags.map((t) => ({
          id: newId(),
          userId,
          name: t.name,
          color: t.color,
          isSystem: true,
        }))
      )
      .onConflictDoNothing();
  },

  update: async (id, patch) => {
    const [row] = await db.update(tag).set(patch).where(eq(tag.id, id)).returning();
    return row;
  },

  delete: async (id) => {
    await db.delete(tag).where(eq(tag.id, id));
  },
};
