import { describe, it, expect, beforeEach } from "vitest";
import {
  makeTagsService,
  TagValidationError,
  TagNotFoundError,
  SystemTagImmutableError,
} from "./service.js";
import { DEFAULT_SYSTEM_TAGS, CATEGORY_TAGS } from "./taxonomy.js";
import type { TagRepo } from "./ports.js";
import type { Tag } from "./types.js";

// Repo fake em memória: prova que o core é testável sem DB e sem Next (ADR-0013).
function makeFakeRepo() {
  let seq = 0;
  const tags: Tag[] = [];

  const repo: TagRepo = {
    findById: async (id) => tags.find((t) => t.id === id) ?? null,
    findByName: async (userId, name) =>
      tags.find((t) => t.userId === userId && t.name === name) ?? null,
    listByUser: async (userId) =>
      tags
        .filter((t) => t.userId === userId)
        .sort(
          (a, b) =>
            Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name)
        ),
    listSystemNames: async (userId) =>
      tags.filter((t) => t.userId === userId && t.isSystem).map((t) => t.name),
    create: async (data) => {
      const tag = { id: `tag-${++seq}`, ...data };
      tags.push(tag);
      return tag;
    },
    createSystemTags: async (userId, toCreate) => {
      for (const t of toCreate) {
        if (!tags.some((x) => x.userId === userId && x.name === t.name)) {
          tags.push({ id: `tag-${++seq}`, userId, isSystem: true, ...t });
        }
      }
    },
    update: async (id, patch) => {
      const tag = tags.find((t) => t.id === id)!;
      Object.assign(tag, patch);
      return tag;
    },
    delete: async (id) => {
      const i = tags.findIndex((t) => t.id === id);
      if (i >= 0) tags.splice(i, 1);
    },
  };

  return { repo, tags };
}

let fake: ReturnType<typeof makeFakeRepo>;
let service: ReturnType<typeof makeTagsService>;

beforeEach(() => {
  fake = makeFakeRepo();
  service = makeTagsService(fake.repo);
});

describe("createTag", () => {
  it("cria com isSystem=false, nome trimado e cor default quando omitida", async () => {
    const tag = await service.createTag({ userId: "u1", name: "  Pets  " });
    expect(tag).toMatchObject({ name: "Pets", isSystem: false, color: "#94a3b8" });
  });

  it("rejeita nome vazio, nome longo e cor inválida", async () => {
    await expect(service.createTag({ userId: "u1", name: "   " })).rejects.toThrow(
      TagValidationError
    );
    await expect(
      service.createTag({ userId: "u1", name: "x".repeat(51) })
    ).rejects.toThrow(TagValidationError);
    await expect(
      service.createTag({ userId: "u1", name: "Pets", color: "#0" })
    ).rejects.toThrow(TagValidationError);
  });

  it("rejeita nome duplicado no mesmo usuário, mas permite em outro", async () => {
    await service.createTag({ userId: "u1", name: "Pets" });
    await expect(service.createTag({ userId: "u1", name: "Pets" })).rejects.toThrow(
      TagValidationError
    );
    await expect(service.createTag({ userId: "u2", name: "Pets" })).resolves.toBeTruthy();
  });
});

describe("ensureSystemTags / listTags", () => {
  it("semeia a taxonomia completa uma única vez (idempotente)", async () => {
    await service.ensureSystemTags("u1");
    await service.ensureSystemTags("u1");
    const system = fake.tags.filter((t) => t.userId === "u1" && t.isSystem);
    expect(system).toHaveLength(DEFAULT_SYSTEM_TAGS.length + CATEGORY_TAGS.length);
  });

  it("listTags semeia antes de listar, system tags primeiro", async () => {
    await service.createTag({ userId: "u1", name: "Zeloso" });
    const tags = await service.listTags("u1");
    expect(tags[0].isSystem).toBe(true);
    expect(tags.at(-1)?.name).toBe("Zeloso");
  });
});

describe("updateTag / deleteTag", () => {
  it("nega acesso a tag de outro usuário como not found", async () => {
    const tag = await service.createTag({ userId: "u1", name: "Pets" });
    await expect(service.updateTag("u2", tag.id, { name: "X" })).rejects.toThrow(
      TagNotFoundError
    );
    await expect(service.deleteTag("u2", tag.id)).rejects.toThrow(TagNotFoundError);
  });

  it("protege system tags contra edição e exclusão", async () => {
    await service.ensureSystemTags("u1");
    const system = fake.tags.find((t) => t.userId === "u1" && t.isSystem)!;
    await expect(service.updateTag("u1", system.id, { name: "X" })).rejects.toThrow(
      SystemTagImmutableError
    );
    await expect(service.deleteTag("u1", system.id)).rejects.toThrow(
      SystemTagImmutableError
    );
  });

  it("rejeita rename para nome já existente, mas aceita re-salvar o próprio nome", async () => {
    await service.createTag({ userId: "u1", name: "Pets" });
    const other = await service.createTag({ userId: "u1", name: "Carro" });
    await expect(service.updateTag("u1", other.id, { name: "Pets" })).rejects.toThrow(
      TagValidationError
    );
    await expect(
      service.updateTag("u1", other.id, { name: "Carro", color: "#123456" })
    ).resolves.toMatchObject({ color: "#123456" });
  });

  it("deleteTag remove a tag do usuário", async () => {
    const tag = await service.createTag({ userId: "u1", name: "Pets" });
    await service.deleteTag("u1", tag.id);
    expect(fake.tags.some((t) => t.id === tag.id)).toBe(false);
  });
});
