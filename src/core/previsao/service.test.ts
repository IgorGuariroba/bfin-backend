import { describe, it, expect, beforeEach } from "vitest";
import {
  makePrevisaoService,
  PrevisaoNotFoundError,
  PrevisaoValidationError,
} from "./service.js";
import type { PrevisaoRepo } from "./ports.js";
import type { Previsao } from "./types.js";

// Repo fake em memória: prova que o core é testável sem DB e sem Next (ADR-0013).
// Os diarios ficam num array próprio com source/user para tornar observável o
// lado destrutivo (apply e baixa) através da interface pública.
interface FakeDiario {
  id: string;
  userId: string;
  source: string;
  description: string;
  amount: number;
  date: Date;
}

interface FakeUser {
  autoBaixaDiario: boolean;
  plan: string;
  planExpiresAt: Date | null;
}

function makeFakeRepo() {
  let seq = 0;
  const previsoes: Previsao[] = [];
  const diarios: FakeDiario[] = [];
  const users = new Map<string, FakeUser>();

  const repo: PrevisaoRepo = {
    listByUser: async (userId) =>
      previsoes
        .filter((p) => p.userId === userId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    create: async (data) => {
      const previsao = { id: `prev-${++seq}`, ...data };
      previsoes.push(previsao);
      return previsao;
    },
    findById: async (id) => previsoes.find((p) => p.id === id) ?? null,
    update: async (id, patch) => {
      const previsao = previsoes.find((p) => p.id === id)!;
      Object.assign(previsao, patch);
      return previsao;
    },
    delete: async (id) => {
      const i = previsoes.findIndex((p) => p.id === id);
      if (i >= 0) previsoes.splice(i, 1);
    },
    deleteManualDiario: async (userId, { gte, lt }) => {
      for (let i = diarios.length - 1; i >= 0; i--) {
        const d = diarios[i];
        if (
          d.userId === userId &&
          d.source === "manual" &&
          d.date >= gte &&
          d.date < lt
        ) {
          diarios.splice(i, 1);
        }
      }
    },
    createDiarios: async (rows) => {
      for (const row of rows) {
        diarios.push({ id: `diario-${++seq}`, source: "manual", ...row });
      }
    },
    // Fakes só de dados — a elegibilidade (regra) é do service, não do repo.
    listAutoBaixaCandidates: async () =>
      [...users.entries()]
        .filter(([, u]) => u.autoBaixaDiario)
        .map(([userId, u]) => ({
          userId,
          plan: u.plan,
          planExpiresAt: u.planExpiresAt,
        })),
    deleteManualDiarioForUsers: async (userIds, { gte, lt }) => {
      let count = 0;
      for (let i = diarios.length - 1; i >= 0; i--) {
        const d = diarios[i];
        if (
          userIds.includes(d.userId) &&
          d.source === "manual" &&
          d.date >= gte &&
          d.date < lt
        ) {
          diarios.splice(i, 1);
          count++;
        }
      }
      return count;
    },
  };

  return { repo, previsoes, diarios, users, nextId: () => `diario-${++seq}` };
}

let fake: ReturnType<typeof makeFakeRepo>;
let service: ReturnType<typeof makePrevisaoService>;

beforeEach(() => {
  fake = makeFakeRepo();
  service = makePrevisaoService(fake.repo);
});

describe("createPrevisao", () => {
  it("rejeita name vazio e amount não numérico ou NaN", async () => {
    await expect(
      service.createPrevisao({ userId: "u1", name: "", amount: 100 }),
    ).rejects.toThrow(PrevisaoValidationError);
    await expect(
      service.createPrevisao({
        userId: "u1",
        name: "Mercado",
        amount: "100" as never,
      }),
    ).rejects.toThrow(PrevisaoValidationError);
    await expect(
      service.createPrevisao({ userId: "u1", name: "Mercado", amount: NaN }),
    ).rejects.toThrow(PrevisaoValidationError);
  });
});

describe("updatePrevisao", () => {
  it("aplica patch parcial mantendo os campos omitidos", async () => {
    const prev = await service.createPrevisao({
      userId: "u1",
      name: "Mercado",
      amount: 800,
    });

    const updated = await service.updatePrevisao({
      userId: "u1",
      id: prev.id,
      amount: 900,
    });

    expect(updated).toMatchObject({
      id: prev.id,
      name: "Mercado",
      amount: 900,
    });
  });

  it("rejeita id inexistente ou de outro dono como not found", async () => {
    const alheia = await service.createPrevisao({
      userId: "u2",
      name: "Uber",
      amount: 200,
    });

    await expect(
      service.updatePrevisao({ userId: "u1", id: "nao-existe", name: "X" }),
    ).rejects.toThrow(PrevisaoNotFoundError);
    await expect(
      service.updatePrevisao({ userId: "u1", id: alheia.id, name: "X" }),
    ).rejects.toThrow(PrevisaoNotFoundError);
  });

  it("rejeita name vazio e amount não numérico ou NaN nos campos enviados", async () => {
    const prev = await service.createPrevisao({
      userId: "u1",
      name: "Mercado",
      amount: 800,
    });

    await expect(
      service.updatePrevisao({ userId: "u1", id: prev.id, name: "" }),
    ).rejects.toThrow(PrevisaoValidationError);
    await expect(
      service.updatePrevisao({
        userId: "u1",
        id: prev.id,
        amount: "900" as never,
      }),
    ).rejects.toThrow(PrevisaoValidationError);
    await expect(
      service.updatePrevisao({ userId: "u1", id: prev.id, amount: NaN }),
    ).rejects.toThrow(PrevisaoValidationError);

    const [intacta] = await service.listPrevisoes("u1");
    expect(intacta).toMatchObject({ name: "Mercado", amount: 800 });
  });
});

describe("deletePrevisao", () => {
  it("remove a previsão do próprio usuário", async () => {
    const prev = await service.createPrevisao({
      userId: "u1",
      name: "Mercado",
      amount: 800,
    });

    await service.deletePrevisao("u1", prev.id);

    expect(await service.listPrevisoes("u1")).toHaveLength(0);
  });

  it("rejeita id inexistente ou de outro dono como not found", async () => {
    const alheia = await service.createPrevisao({
      userId: "u2",
      name: "Uber",
      amount: 200,
    });

    await expect(service.deletePrevisao("u1", "nao-existe")).rejects.toThrow(
      PrevisaoNotFoundError,
    );
    await expect(service.deletePrevisao("u1", alheia.id)).rejects.toThrow(
      PrevisaoNotFoundError,
    );
    expect(await service.listPrevisoes("u2")).toHaveLength(1);
  });
});

describe("applyPrevisao", () => {
  const now = new Date(2026, 6, 2, 15, 30); // 2026-07-02, hora arbitrária

  it("cria um diario manual ao meio-dia por dia na janela de 12 meses e retorna o count", async () => {
    const { count } = await service.applyPrevisao(
      { userId: "u1", amount: 150 },
      now,
    );

    expect(count).toBe(365); // 2026-07-02 .. 2027-07-01
    expect(fake.diarios).toHaveLength(365);

    const first = fake.diarios[0];
    expect(first).toMatchObject({
      userId: "u1",
      description: "Previsão Diária",
      amount: 150,
      source: "manual",
    });
    // Primeiro dia = hoje, ao meio-dia local (invariante da baixa — ADR-0005 §7).
    expect([
      first.date.getFullYear(),
      first.date.getMonth(),
      first.date.getDate(),
    ]).toEqual([2026, 6, 2]);
    expect(first.date.getHours()).toBe(12);

    const last = fake.diarios[fake.diarios.length - 1];
    expect([
      last.date.getFullYear(),
      last.date.getMonth(),
      last.date.getDate(),
    ]).toEqual([2027, 6, 1]);
  });

  it("deleta os diario manuais na janela antes de recriar, preservando importados e fora da janela", async () => {
    const seed = (over: Partial<FakeDiario>) =>
      fake.diarios.push({
        id: fake.nextId(),
        userId: "u1",
        source: "manual",
        description: "Previsão Diária",
        amount: 99,
        date: new Date(2026, 7, 10, 12, 0, 0), // dentro da janela
        ...over,
      });

    seed({}); // manual na janela → deve sumir
    seed({ id: "importado", source: "pluggy" }); // importado → preservado
    seed({ id: "passado", date: new Date(2026, 5, 30, 12, 0, 0) }); // antes da janela → preservado
    seed({ id: "outro-user", userId: "u2" }); // de outro usuário → preservado

    await service.applyPrevisao({ userId: "u1", amount: 150 }, now);

    const ids = fake.diarios.map((d) => d.id);
    expect(ids).toContain("importado");
    expect(ids).toContain("passado");
    expect(ids).toContain("outro-user");
    // 365 recriados + 3 preservados; o manual antigo na janela não sobrevive.
    expect(fake.diarios).toHaveLength(368);
    expect(
      fake.diarios.filter((d) => d.amount === 99 && d.userId === "u1"),
    ).toHaveLength(2);
  });

  it("grava o valor absoluto quando amount vem negativo", async () => {
    await service.applyPrevisao({ userId: "u1", amount: -150 }, now);

    expect(fake.diarios[0].amount).toBe(150);
  });

  it("rejeita amount não numérico ou NaN", async () => {
    await expect(
      service.applyPrevisao({ userId: "u1", amount: "150" as never }, now),
    ).rejects.toThrow(PrevisaoValidationError);
    await expect(
      service.applyPrevisao({ userId: "u1", amount: NaN }, now),
    ).rejects.toThrow(PrevisaoValidationError);
    expect(fake.diarios).toHaveLength(0);
  });

  it("rejeita amount nulo sem deletar nada", async () => {
    fake.diarios.push({
      id: "existente",
      userId: "u1",
      source: "manual",
      description: "Previsão Diária",
      amount: 99,
      date: new Date(2026, 7, 10, 12, 0, 0),
    });

    await expect(
      service.applyPrevisao({ userId: "u1", amount: null as never }, now),
    ).rejects.toThrow(PrevisaoValidationError);
    expect(fake.diarios).toHaveLength(1);
  });
});

describe("baixaDiaria", () => {
  // 2026-07-02 15:00 UTC = 12:00 em São Paulo; o dia SP corrente é 2026-07-02.
  const now = new Date(Date.UTC(2026, 6, 2, 15, 0, 0));
  const seedDiario = (
    id: string,
    userId: string,
    date: Date,
    source = "manual",
  ) =>
    fake.diarios.push({
      id,
      userId,
      source,
      description: "Previsão Diária",
      amount: 99,
      date,
    });

  it("exclui só o diario manual do dia corrente em São Paulo dos usuários aptos e retorna o count", async () => {
    fake.users.set("pro-on", {
      autoBaixaDiario: true,
      plan: "pro",
      planExpiresAt: null,
    });
    fake.users.set("free-on", {
      autoBaixaDiario: true,
      plan: "free",
      planExpiresAt: null,
    });

    const hoje = new Date(Date.UTC(2026, 6, 2, 12, 0, 0)); // meio-dia UTC de hoje
    const amanha = new Date(Date.UTC(2026, 6, 3, 12, 0, 0));
    seedDiario("hoje", "pro-on", hoje);
    seedDiario("amanha", "pro-on", amanha); // futuro → preservado
    seedDiario("importado", "pro-on", hoje, "pluggy"); // importado → preservado
    seedDiario("free", "free-on", hoje); // não elegível → preservado

    const { count } = await service.baixaDiaria(now);

    expect(count).toBe(1);
    const ids = fake.diarios.map((d) => d.id);
    expect(ids).not.toContain("hoje");
    expect(ids).toEqual(
      expect.arrayContaining(["amanha", "importado", "free"]),
    );
  });

  it("preserva o diario de pro com plano vencido e baixa o de pro com expiração futura", async () => {
    fake.users.set("pro-vencido", {
      autoBaixaDiario: true,
      plan: "pro",
      planExpiresAt: new Date(Date.UTC(2026, 6, 1, 0, 0, 0)), // antes de now
    });
    fake.users.set("pro-vigente", {
      autoBaixaDiario: true,
      plan: "pro",
      planExpiresAt: new Date(Date.UTC(2026, 11, 31, 0, 0, 0)), // depois de now
    });

    const hoje = new Date(Date.UTC(2026, 6, 2, 12, 0, 0));
    seedDiario("do-vencido", "pro-vencido", hoje);
    seedDiario("do-vigente", "pro-vigente", hoje);

    const { count } = await service.baixaDiaria(now);

    expect(count).toBe(1);
    const ids = fake.diarios.map((d) => d.id);
    expect(ids).toContain("do-vencido");
    expect(ids).not.toContain("do-vigente");
  });

  it("preserva o diario de pro que não optou (flag desligada)", async () => {
    fake.users.set("pro-off", {
      autoBaixaDiario: false,
      plan: "pro",
      planExpiresAt: null,
    });
    seedDiario(
      "do-pro-off",
      "pro-off",
      new Date(Date.UTC(2026, 6, 2, 12, 0, 0)),
    );

    const { count } = await service.baixaDiaria(now);

    expect(count).toBe(0);
    expect(fake.diarios.map((d) => d.id)).toContain("do-pro-off");
  });

  it("retorna count 0 sem candidatos elegíveis", async () => {
    const { count } = await service.baixaDiaria(now);

    expect(count).toBe(0);
  });
});

describe("listPrevisoes", () => {
  it("lista apenas as previsões do próprio usuário", async () => {
    await service.createPrevisao({
      userId: "u1",
      name: "Mercado",
      amount: 800,
    });
    await service.createPrevisao({ userId: "u2", name: "Uber", amount: 200 });

    const result = await service.listPrevisoes("u1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: "u1",
      name: "Mercado",
      amount: 800,
    });
  });
});
