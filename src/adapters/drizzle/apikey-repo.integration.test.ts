import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { user as userTable } from "../../db/schema.js";
import { apiKeysService } from "../index.js";
import { ApiKeyNotFoundError } from "../../core/apikeys/index.js";
import { drizzleApiKeyRepo } from "./apikey-repo.js";
import { trackCreatedUsers } from "./test-helpers.js";

const trackUser = trackCreatedUsers();

async function seedUser(plan = "pro") {
  const [row] = await db
    .insert(userTable)
    .values({ id: crypto.randomUUID(), name: "ApiKey User", email: `apikey-${crypto.randomUUID()}@example.com`, plan })
    .returning();
  trackUser(row.id);
  return row;
}

describe("issueApiKey", () => {
  it("emite uma chave e a lista sem o hash", async () => {
    const user = await seedUser();
    const issued = await apiKeysService.issueApiKey(user.id);
    expect(issued.plain).toMatch(/^sk-bfin-/);

    const list = await apiKeysService.listApiKeys(user.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: issued.id, name: issued.name, prefix: issued.prefix });
  });

  it("revoga a chave anterior ao emitir uma nova (invariante: 1 ativa por vez)", async () => {
    const user = await seedUser();
    const primeira = await apiKeysService.issueApiKey(user.id);
    const segunda = await apiKeysService.issueApiKey(user.id);

    const list = await apiKeysService.listApiKeys(user.id);
    expect(list.find((k) => k.id === primeira.id)?.revokedAt).not.toBeNull();
    expect(list.find((k) => k.id === segunda.id)?.revokedAt).toBeNull();
  });
});

describe("revokeApiKey", () => {
  it("revoga e é idempotente (preserva o revokedAt original)", async () => {
    const user = await seedUser();
    const issued = await apiKeysService.issueApiKey(user.id);

    await apiKeysService.revokeApiKey(user.id, issued.id);
    const [afterFirst] = await apiKeysService.listApiKeys(user.id);
    expect(afterFirst.revokedAt).not.toBeNull();

    await apiKeysService.revokeApiKey(user.id, issued.id);
    const [afterSecond] = await apiKeysService.listApiKeys(user.id);
    expect(afterSecond.revokedAt?.getTime()).toBe(afterFirst.revokedAt?.getTime());
  });

  it("id de outra conta é not found (anti-IDOR)", async () => {
    const dono = await seedUser();
    const invasor = await seedUser();
    const issued = await apiKeysService.issueApiKey(dono.id);

    await expect(apiKeysService.revokeApiKey(invasor.id, issued.id)).rejects.toBeInstanceOf(
      ApiKeyNotFoundError
    );
  });
});

describe("drizzleApiKeyRepo", () => {
  it("revoke de id inexistente lança ApiKeyNotFoundError (guard de race, não Error genérico)", async () => {
    await expect(drizzleApiKeyRepo.revoke("id-inexistente", new Date())).rejects.toBeInstanceOf(
      ApiKeyNotFoundError
    );
  });

  it("bumpLastUsed de id inexistente lança ApiKeyNotFoundError (guard de race, não Error genérico)", async () => {
    await expect(drizzleApiKeyRepo.bumpLastUsed("id-inexistente", new Date())).rejects.toBeInstanceOf(
      ApiKeyNotFoundError
    );
  });
});

describe("resolvePrincipal", () => {
  it("resolve o principal de uma chave válida e carimba lastUsedAt", async () => {
    const user = await seedUser();
    const issued = await apiKeysService.issueApiKey(user.id);

    expect(await apiKeysService.resolvePrincipal(issued.plain)).toEqual({
      userId: user.id,
      apiKeyId: issued.id,
    });
    const [key] = await apiKeysService.listApiKeys(user.id);
    expect(key.lastUsedAt).not.toBeNull();
  });

  it("rejeita chave de usuário que sofreu downgrade para free", async () => {
    const user = await seedUser("pro");
    const issued = await apiKeysService.issueApiKey(user.id);
    await db.update(userTable).set({ plan: "free" }).where(eq(userTable.id, user.id));

    expect(await apiKeysService.resolvePrincipal(issued.plain)).toBeNull();
  });
});
