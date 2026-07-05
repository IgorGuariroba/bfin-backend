import { describe, it, expect } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { tag, user as userTable } from "../../db/schema.js";
import { tagsService } from "../index.js";
import { DEFAULT_SYSTEM_TAGS, CATEGORY_TAGS } from "../../core/tags/index.js";
import { trackCreatedUsers } from "./test-helpers.js";

const trackUser = trackCreatedUsers();

async function seedUser() {
  const [row] = await db
    .insert(userTable)
    .values({ id: crypto.randomUUID(), name: "Tag User", email: `tags-${crypto.randomUUID()}@example.com`, plan: "pro" })
    .returning();
  trackUser(row.id);
  return row;
}

describe("ensureSystemTags", () => {
  it("semeia type-mirrors + categorias canônicas como system tags", async () => {
    const user = await seedUser();

    await tagsService.ensureSystemTags(user.id);

    const tags = await db
      .select()
      .from(tag)
      .where(and(eq(tag.userId, user.id), eq(tag.isSystem, true)));
    const names = tags.map((t) => t.name).sort();
    const expected = [
      ...DEFAULT_SYSTEM_TAGS.map((t) => t.name),
      ...CATEGORY_TAGS.map((t) => t.name),
    ].sort();
    expect(names).toEqual(expected);
    // categorias específicas da #93 presentes
    expect(names).toContain("Transporte");
    expect(names).toContain("Alimentação");
    expect(names).toContain("Moradia");
  });

  it("é idempotente: rodar duas vezes não duplica nem recria", async () => {
    const user = await seedUser();

    async function countSystemTags() {
      const [row] = await db
        .select({ n: count() })
        .from(tag)
        .where(and(eq(tag.userId, user.id), eq(tag.isSystem, true)));
      return row.n;
    }

    await tagsService.ensureSystemTags(user.id);
    const after1 = await countSystemTags();
    await tagsService.ensureSystemTags(user.id);
    const after2 = await countSystemTags();

    expect(after2).toBe(after1);
    expect(after1).toBe(DEFAULT_SYSTEM_TAGS.length + CATEGORY_TAGS.length);
  });
});
