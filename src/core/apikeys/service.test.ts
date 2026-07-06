import { describe, it, expect, beforeEach } from "vitest";
import { makeApiKeysService, ApiKeyNotFoundError } from "./service.js";
import { ProRequiredError } from "../identity/index.js";
import type { ApiKeyRepo } from "./ports.js";
import type { Plan } from "../identity/index.js";

// Repo fake em memória: prova que o core é testável sem DB e sem Next (ADR-0013).
interface FakeKey {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  hashedKey: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

function makeFakeRepo() {
  let seq = 0;
  const keys: FakeKey[] = [];

  const repo: ApiKeyRepo = {
    listByUser: async (userId) =>
      keys
        .filter((k) => k.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    revokeAllActive: async (userId, at) => {
      for (const k of keys) {
        if (k.userId === userId && k.revokedAt === null) k.revokedAt = at;
      }
    },
    create: async (data) => {
      const key: FakeKey = {
        id: `key-${++seq}`,
        lastUsedAt: null,
        createdAt: new Date(2026, 0, seq),
        revokedAt: null,
        ...data,
      };
      keys.push(key);
      return {
        id: key.id,
        prefix: key.prefix,
        name: key.name,
        createdAt: key.createdAt,
      };
    },
    findOwned: async (userId, id) => {
      const key = keys.find((k) => k.id === id && k.userId === userId);
      return key ? { id: key.id, revokedAt: key.revokedAt } : null;
    },
    revoke: async (id, at) => {
      const key = keys.find((k) => k.id === id);
      if (key) key.revokedAt = at;
    },
    findByHashedKey: async (hashedKey) => {
      const key = keys.find((k) => k.hashedKey === hashedKey);
      return key
        ? { id: key.id, userId: key.userId, revokedAt: key.revokedAt }
        : null;
    },
    bumpLastUsed: async (id, at) => {
      const key = keys.find((k) => k.id === id);
      if (key) key.lastUsedAt = at;
    },
  };

  return { repo, keys };
}

let fake: ReturnType<typeof makeFakeRepo>;
let plans: Map<string, Plan>;
let logs: { level: string; data: Record<string, unknown> }[];
let service: ReturnType<typeof makeApiKeysService>;

function buildService(
  over: Partial<Parameters<typeof makeApiKeysService>[1]> = {},
) {
  return makeApiKeysService(fake.repo, {
    getUserPlan: async (userId) => plans.get(userId) ?? "free",
    generateKey: () => {
      const rand = crypto.randomUUID();
      return {
        plain: `sk-bfin-${rand}`,
        prefix: `sk-bfin-${rand.slice(0, 4)}`,
        hashedKey: `hash:sk-bfin-${rand}`,
      };
    },
    hashKey: (plain) => `hash:${plain}`,
    logger: {
      info: (data) => logs.push({ level: "info", data }),
      warn: (data) => logs.push({ level: "warn", data }),
    },
    ...over,
  });
}

beforeEach(() => {
  fake = makeFakeRepo();
  plans = new Map();
  logs = [];
  service = buildService();
});

describe("issueApiKey", () => {
  it("pro emite: devolve o plain uma única vez e revoga a chave ativa anterior", async () => {
    plans.set("u1", "pro");

    const primeira = await service.issueApiKey("u1");
    const segunda = await service.issueApiKey("u1");

    expect(segunda.plain).toMatch(/^sk-bfin-/);
    expect(segunda.name).toBe("Assistente");
    expect(
      fake.keys.find((k) => k.id === primeira.id)?.revokedAt,
    ).not.toBeNull();
    expect(fake.keys.find((k) => k.id === segunda.id)?.revokedAt).toBeNull();
  });

  it("free não emite (ProRequiredError)", async () => {
    await expect(service.issueApiKey("free")).rejects.toBeInstanceOf(
      ProRequiredError,
    );
    expect(fake.keys).toHaveLength(0);
  });
});

describe("listApiKeys", () => {
  it("lista apenas as chaves do próprio usuário", async () => {
    plans.set("u1", "pro");
    plans.set("u2", "pro");
    await service.issueApiKey("u1");
    await service.issueApiKey("u2");

    const listed = await service.listApiKeys("u1");

    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("Assistente");
  });
});

describe("revokeApiKey", () => {
  it("revoga a própria chave; repetir não sobrescreve o timestamp original", async () => {
    plans.set("u1", "pro");
    const key = await service.issueApiKey("u1");

    await service.revokeApiKey("u1", key.id);
    const firstRevokedAt = fake.keys[0].revokedAt;
    expect(firstRevokedAt).not.toBeNull();

    await service.revokeApiKey("u1", key.id);
    expect(fake.keys[0].revokedAt).toBe(firstRevokedAt);
  });

  it("id inexistente ou de outro dono vira not found", async () => {
    plans.set("u1", "pro");
    const key = await service.issueApiKey("u1");

    await expect(service.revokeApiKey("u2", key.id)).rejects.toBeInstanceOf(
      ApiKeyNotFoundError,
    );
    await expect(
      service.revokeApiKey("u1", "nao-existe"),
    ).rejects.toBeInstanceOf(ApiKeyNotFoundError);
  });
});

describe("resolvePrincipal", () => {
  it("token válido de pro resolve userId/apiKeyId e carimba lastUsedAt", async () => {
    plans.set("u1", "pro");
    const key = await service.issueApiKey("u1");

    const principal = await service.resolvePrincipal(key.plain);

    expect(principal).toEqual({ userId: "u1", apiKeyId: key.id });
    expect(fake.keys.find((k) => k.id === key.id)?.lastUsedAt).not.toBeNull();
  });

  it("token inexistente, chave revogada ou dono não-pro resolvem null", async () => {
    plans.set("u1", "pro");
    const revogada = await service.issueApiKey("u1");
    await service.revokeApiKey("u1", revogada.id);

    plans.set("u2", "pro");
    const deFree = await service.issueApiKey("u2");
    plans.set("u2", "free"); // downgrade após emissão

    expect(await service.resolvePrincipal("sk-bfin-nao-existe")).toBeNull();
    expect(await service.resolvePrincipal(revogada.plain)).toBeNull();
    expect(await service.resolvePrincipal(deFree.plain)).toBeNull();
    // nenhum bump em falha de resolução
    expect(fake.keys.every((k) => k.lastUsedAt === null)).toBe(true);
  });
});

describe("recordAgentWrite", () => {
  it("emite log estruturado e carimba lastUsedAt da chave", async () => {
    plans.set("u1", "pro");
    const key = await service.issueApiKey("u1");

    await service.recordAgentWrite({
      apiKeyId: key.id,
      userId: "u1",
      action: "create",
      entityId: "tx-1",
    });

    expect(logs).toContainEqual({
      level: "info",
      data: {
        apiKeyId: key.id,
        userId: "u1",
        action: "create",
        entityId: "tx-1",
      },
    });
    expect(fake.keys.find((k) => k.id === key.id)?.lastUsedAt).not.toBeNull();
  });

  it("falha no bump não estoura: loga warn e preserva a trilha", async () => {
    service = buildService();
    fake.repo.bumpLastUsed = async () => {
      throw new Error("db down");
    };

    await expect(
      service.recordAgentWrite({
        apiKeyId: "key-x",
        userId: "u1",
        action: "delete",
        entityId: "tx-9",
      }),
    ).resolves.toBeUndefined();

    expect(logs.some((l) => l.level === "info")).toBe(true);
    expect(logs.some((l) => l.level === "warn")).toBe(true);
  });
});
