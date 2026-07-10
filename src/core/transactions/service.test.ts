import { describe, it, expect } from "vitest";
import {
  makeTransactionsService,
  MAX_LIST_RESULTS,
  TransactionNotFoundError,
  TransactionValidationError,
  type TransactionsService,
} from "./service.js";
import type { TransactionRepo, NewTransaction } from "./ports.js";
import type { TransactionWithTags } from "./types.js";

/**
 * Repo fake em memória (gabarito do piloto tags): comportamento observável via
 * porta pública, sem DB e sem Next. `ownedTags` alimenta o anti-IDOR de tags.
 */
function fakeRepo() {
  const rows: TransactionWithTags[] = [];
  const ownedTags = new Map<string, Set<string>>();
  let seq = 0;

  const materialize = (
    data: NewTransaction,
    tagIds?: string[],
  ): TransactionWithTags => ({
    ...data,
    id: `t${++seq}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    externalId: null,
    pluggyItemId: null,
    tags: (tagIds ?? []).map((id) => ({
      id,
      name: `tag-${id}`,
      color: "#000",
    })),
  });

  const repo: TransactionRepo = {
    async list(query, take) {
      return rows
        .filter((r) => r.userId === query.userId)
        .filter((r) => (query.type ? r.type === query.type : true))
        .filter((r) =>
          query.tagId ? r.tags.some((t) => t.id === query.tagId) : true,
        )
        .filter((r) => {
          const { date } = query;
          if (!date) return true;
          if (date.gte && r.date < date.gte) return false;
          if (date.lt && r.date >= date.lt) return false;
          if (date.lte && r.date > date.lte) return false;
          return true;
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, take);
    },
    async findDuplicate(userId, type, amount, window) {
      return (
        rows
          .filter(
            (r) =>
              r.userId === userId &&
              r.type === type &&
              r.amount === amount &&
              r.date >= window.gte &&
              r.date <= window.lte,
          )
          .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null
      );
    },
    async countOwnedTags(userId, tagIds) {
      const owned = ownedTags.get(userId) ?? new Set();
      return tagIds.filter((id) => owned.has(id)).length;
    },
    async create(data, tagIds) {
      const row = materialize(data, tagIds);
      rows.push(row);
      return row;
    },
    async createMany(data, tagIds) {
      for (const d of data) rows.push(materialize(d, tagIds));
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async update(id, patch, tagIds) {
      const row = rows.find((r) => r.id === id)!;
      Object.assign(row, patch, { updatedAt: new Date() });
      if (tagIds !== undefined) {
        row.tags = tagIds.map((tid) => ({
          id: tid,
          name: `tag-${tid}`,
          color: "#000",
        }));
      }
      return row;
    },
    async deleteOwned(userId, id) {
      const i = rows.findIndex((r) => r.id === id && r.userId === userId);
      if (i === -1) return false;
      rows.splice(i, 1);
      return true;
    },
  };

  const grantTag = (userId: string, tagId: string) => {
    if (!ownedTags.has(userId)) ownedTags.set(userId, new Set());
    ownedTags.get(userId)!.add(tagId);
  };

  return { repo, rows, grantTag };
}

/**
 * Monta o service injetando listTags controlável. Default: usuário sem Tags —
 * os testes de create/list/update/delete não exercitam sugestão. Os testes de
 * suggest/createSuggested passam um listTags fake próprio (user story 17).
 */
function makeService(
  repo: TransactionRepo,
  deps: {
    listTags?: (userId: string) => Promise<{ id: string; name: string }[]>;
    logger?: {
      warn: (data: Record<string, unknown>, msg: string) => void;
    };
  } = {},
) {
  return makeTransactionsService(repo, {
    listTags: deps.listTags ?? (async () => []),
    logger: deps.logger,
  });
}

describe("createTransaction", () => {
  it("cria via porta com defaults (source manual, repeat none) e retorna duplicated:false", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo);

    const { transaction, duplicated } = await svc.createTransaction({
      userId: "u1",
      type: "saida",
      description: "Mercado",
      amount: 120,
      date: "2026-06-10",
    });

    expect(duplicated).toBe(false);
    expect(transaction.userId).toBe("u1");
    expect(transaction.source).toBe("manual");
    expect(transaction.repeat).toBe("none");
    // Meio-dia local: imune a off-by-one de fuso (ADR-0005).
    expect(transaction.date.getFullYear()).toBe(2026);
    expect(transaction.date.getMonth()).toBe(5);
    expect(transaction.date.getDate()).toBe(10);
    expect(rows).toHaveLength(1);
  });

  it("rejeita campos ausentes, type inválido, diario e amount não-positivo sem tocar a porta", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo);
    const valid = {
      userId: "u1",
      type: "saida",
      description: "Mercado",
      amount: 120,
      date: "2026-06-10",
    };

    await expect(
      svc.createTransaction({ ...valid, description: "" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      svc.createTransaction({ ...valid, type: "investimento" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    // `diario` é reservado à projeção (apply_previsao) — escrita de usuário/agente
    // jamais o cria (ADR-0004 §4).
    await expect(
      svc.createTransaction({ ...valid, type: "diario" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      svc.createTransaction({ ...valid, amount: 0 }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      svc.createTransaction({ ...valid, date: "2026-02-30" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      svc.createTransaction({ ...valid, date: 20260610 as unknown as string }),
    ).rejects.toBeInstanceOf(TransactionValidationError);

    expect(rows).toHaveLength(0);
  });

  it("anti-IDOR: rejeita tagIds que não pertencem ao usuário e não cria nada", async () => {
    const { repo, rows, grantTag } = fakeRepo();
    grantTag("outro-usuario", "tag-alheia");
    const svc = makeService(repo);

    await expect(
      svc.createTransaction({
        userId: "u1",
        type: "saida",
        description: "Mercado",
        amount: 120,
        date: "2026-06-10",
        tagIds: ["tag-alheia"],
      }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    expect(rows).toHaveLength(0);
  });

  it("aceita tagIds duplicados (deduplica) e conecta a tag uma única vez", async () => {
    const { repo, grantTag } = fakeRepo();
    grantTag("u1", "tag-a");
    const svc = makeService(repo);

    const { transaction } = await svc.createTransaction({
      userId: "u1",
      type: "saida",
      description: "Mercado",
      amount: 120,
      date: "2026-06-10",
      tagIds: ["tag-a", "tag-a"],
    });

    expect(transaction.tags.map((t) => t.id)).toEqual(["tag-a"]);
  });
});

describe("createTransaction — dedup defensivo (ADR-0004)", () => {
  const base = {
    userId: "u1",
    type: "saida",
    description: "Mercado",
    amount: 120,
    date: "2026-06-10",
  };

  it("sem force, retorna a candidata existente (±2 dias, mesmo type+amount) sem criar", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo);
    const { transaction: original } = await svc.createTransaction(base);

    const { transaction, duplicated } = await svc.createTransaction({
      ...base,
      description: "Compra mercado",
      date: "2026-06-12", // dentro da janela de ±2 dias
    });

    expect(duplicated).toBe(true);
    expect(transaction.id).toBe(original.id);
    expect(rows).toHaveLength(1);
  });

  it("com force=true cria nova mesmo havendo candidata; fora da janela cria normal", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo);
    await svc.createTransaction(base);

    const forced = await svc.createTransaction({ ...base, force: true });
    expect(forced.duplicated).toBe(false);

    const distant = await svc.createTransaction({
      ...base,
      date: "2026-06-13",
    }); // +3 dias
    expect(distant.duplicated).toBe(false);
    expect(rows).toHaveLength(3);
  });
});

describe("createTransaction — recorrência", () => {
  it("repeat mensal com repeatEnd=count gera as ocorrências extras com as mesmas tags", async () => {
    const { repo, rows, grantTag } = fakeRepo();
    grantTag("u1", "tag-a");
    const svc = makeService(repo);

    await svc.createTransaction({
      userId: "u1",
      type: "saida",
      description: "Aluguel",
      amount: 1500,
      date: "2026-06-10",
      repeat: "monthly",
      repeatEnd: "count",
      repeatCount: 3,
      tagIds: ["tag-a"],
      force: true,
    });

    // count=3 → base + 2 extras, avançando mês a mês.
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.date.getMonth())).toEqual([5, 6, 7]);
    expect(rows.every((r) => r.tags.some((t) => t.id === "tag-a"))).toBe(true);
  });

  it("repeat semanal com repeatEnd=forever gera 12 ocorrências extras", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo);

    await svc.createTransaction({
      userId: "u1",
      type: "saida",
      description: "Feira",
      amount: 80,
      date: "2026-06-10",
      repeat: "weekly",
      repeatEnd: "forever",
      force: true,
    });

    expect(rows).toHaveLength(13); // base + 12
    expect(rows[1].date.getDate()).toBe(17); // semanal: +7 dias
  });
});

describe("listTransactions", () => {
  async function seed(svc: TransactionsService) {
    await svc.createTransaction({
      userId: "u1",
      type: "saida",
      description: "Maio",
      amount: 10,
      date: "2026-05-20",
      force: true,
    });
    await svc.createTransaction({
      userId: "u1",
      type: "saida",
      description: "Junho",
      amount: 20,
      date: "2026-06-10",
      force: true,
    });
    await svc.createTransaction({
      userId: "u1",
      type: "entrada",
      description: "Salário",
      amount: 5000,
      date: "2026-06-05",
      force: true,
    });
    await svc.createTransaction({
      userId: "u2",
      type: "saida",
      description: "Alheia",
      amount: 30,
      date: "2026-06-10",
      force: true,
    });
  }

  it("filtra por mês (ordenado por data) sem vazar transações de outro usuário", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo);
    await seed(svc);

    const result = await svc.listTransactions("u1", { month: "2026-06" });
    expect(result.map((t) => t.description)).toEqual(["Salário", "Junho"]);
  });

  it("filtra por intervalo from/to e por type", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo);
    await seed(svc);

    const range = await svc.listTransactions("u1", {
      from: "2026-06-05",
      to: "2026-06-05",
    });
    expect(range.map((t) => t.description)).toEqual(["Salário"]);

    const byType = await svc.listTransactions("u1", { type: "saida" });
    expect(byType.map((t) => t.description)).toEqual(["Maio", "Junho"]);
  });

  it("rejeita month e from/to malformados com TransactionValidationError", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo);

    await expect(
      svc.listTransactions("u1", { month: "2026-13" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      svc.listTransactions("u1", { from: "10/06/2026" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      svc.listTransactions("u1", { to: "2026-02-30" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
  });

  it("corta no teto MAX_LIST_RESULTS e avisa o logger injetado", async () => {
    const { repo } = fakeRepo();
    const warnings: string[] = [];
    const svc = makeService(repo, {
      logger: { warn: (_data, msg) => warnings.push(msg) },
    });
    for (let i = 0; i < MAX_LIST_RESULTS + 1; i++) {
      await repo.create(
        {
          userId: "u1",
          type: "saida",
          description: `tx-${i}`,
          amount: 1,
          date: new Date(2026, 0, 1, 12),
          source: "manual",
          repeat: "none",
          repeatEnd: "forever",
          repeatCount: 0,
        },
        undefined,
      );
    }

    const result = await svc.listTransactions("u1");
    expect(result).toHaveLength(MAX_LIST_RESULTS);
    expect(warnings).toHaveLength(1);
  });
});

describe("updateTransaction", () => {
  async function seedTx(svc: TransactionsService, type = "saida") {
    const { transaction } = await svc.createTransaction({
      userId: "u1",
      type,
      description: "Mercado",
      amount: 120,
      date: "2026-06-10",
      force: true,
    });
    return transaction;
  }

  it("aplica patch parcial mantendo os demais campos", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo);
    const tx = await seedTx(svc);

    const updated = await svc.updateTransaction({
      userId: "u1",
      id: tx.id,
      amount: 150,
      date: "2026-06-11",
    });

    expect(updated.amount).toBe(150);
    expect(updated.date.getDate()).toBe(11);
    expect(updated.description).toBe("Mercado"); // intacto
  });

  it("anti-IDOR: id de outro dono (ou inexistente) vira TransactionNotFoundError sem mutar", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo);
    const tx = await seedTx(svc);

    await expect(
      svc.updateTransaction({
        userId: "atacante",
        id: tx.id,
        description: "Hackeado",
      }),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
    // NotFound é subtipo de validação: consumidores que mapeiam
    // TransactionValidationError → 400/tool-error continuam cobertos.
    await expect(
      svc.updateTransaction({ userId: "u1", id: "nao-existe", amount: 1 }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    expect(rows[0].description).toBe("Mercado");
  });

  it("rejeita type/amount/date inválidos e transição para diario", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo);
    const tx = await seedTx(svc);

    await expect(
      svc.updateTransaction({ userId: "u1", id: tx.id, type: "investimento" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    // Transformar uma Transaction real em `diario` a exporia ao deleteMany do
    // apply_previsao (ADR-0004 §4) — nunca permitido.
    await expect(
      svc.updateTransaction({ userId: "u1", id: tx.id, type: "diario" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      svc.updateTransaction({ userId: "u1", id: tx.id, amount: 0 }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      svc.updateTransaction({ userId: "u1", id: tx.id, date: "2026-02-30" }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    expect(rows[0].type).toBe("saida");
  });

  it("aceita type=diario quando a transaction já é diario (edição de placeholder pela UI)", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo);
    // Placeholder diario nasce fora do boundary de escrita (apply_previsao) —
    // simulado direto na porta.
    const placeholder = await repo.create(
      {
        userId: "u1",
        type: "diario",
        description: "Diário",
        amount: 50,
        date: new Date(2026, 5, 10, 12),
        source: "manual",
        repeat: "none",
        repeatEnd: "forever",
        repeatCount: 0,
      },
      undefined,
    );

    const updated = await svc.updateTransaction({
      userId: "u1",
      id: placeholder.id,
      type: "diario",
      amount: 75,
    });

    expect(updated.type).toBe("diario");
    expect(updated.amount).toBe(75);
  });

  it("anti-IDOR de tags: rejeita tagIds alheios; tagIds=[] desconecta todas", async () => {
    const { repo, grantTag } = fakeRepo();
    grantTag("u1", "tag-a");
    grantTag("outro", "tag-alheia");
    const svc = makeService(repo);
    const tx = await seedTx(svc);

    await expect(
      svc.updateTransaction({
        userId: "u1",
        id: tx.id,
        tagIds: ["tag-alheia"],
      }),
    ).rejects.toBeInstanceOf(TransactionValidationError);

    const withTag = await svc.updateTransaction({
      userId: "u1",
      id: tx.id,
      tagIds: ["tag-a"],
    });
    expect(withTag.tags.map((t) => t.id)).toEqual(["tag-a"]);

    const cleared = await svc.updateTransaction({
      userId: "u1",
      id: tx.id,
      tagIds: [],
    });
    expect(cleared.tags).toEqual([]);
  });
});

describe("deleteTransaction", () => {
  it("remove a Transaction do próprio usuário; id alheio/inexistente vira NotFound", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo);
    const { transaction } = await svc.createTransaction({
      userId: "u1",
      type: "saida",
      description: "X",
      amount: 10,
      date: "2026-06-10",
    });

    await expect(
      svc.deleteTransaction("atacante", transaction.id),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
    expect(rows).toHaveLength(1);

    await svc.deleteTransaction("u1", transaction.id);
    expect(rows).toHaveLength(0);
  });
});

/**
 * Tags em memória para o fake de listTags (user story 17): o core de Transações
 * recebe a consulta como dependência, então o teste de sugestão não precisa do
 * service de Tags real nem do banco.
 */
const TAGS = [
  { id: "tag-academia", name: "Academia" },
  { id: "tag-moradia", name: "Moradia" }, // casará por categoria (keyword "aluguel")
];
const listTagsFake = async () => TAGS;

describe("suggest", () => {
  it("sem type explícito, infere saida para gasto e entrada para receita", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo, { listTags: listTagsFake });

    const gasto = await svc.suggest({
      userId: "u1",
      description: "Mercado",
    });
    expect(gasto.type).toBe("saida");

    const receita = await svc.suggest({
      userId: "u1",
      description: "Salário",
    });
    expect(receita.type).toBe("entrada");
  });

  it("com type explícito, prevalece sobre a inferência", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo, { listTags: listTagsFake });

    const result = await svc.suggest({
      userId: "u1",
      description: "Salário", // inferiria entrada
      type: "saida",
    });
    expect(result.type).toBe("saida");
  });

  it("sugere Tag por nome próprio (prioridade) e ignora acentos", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo, { listTags: listTagsFake });

    const result = await svc.suggest({
      userId: "u1",
      description: "mensalidade da ACADEMIA",
    });
    expect(result).toEqual({ type: "saida", tagId: "tag-academia" });
  });

  it("cai na categoria quando nenhuma Tag casa por nome", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo, { listTags: listTagsFake });

    const result = await svc.suggest({
      userId: "u1",
      description: "aluguel do apartamento",
    });
    expect(result.tagId).toBe("tag-moradia");
  });

  it("retorna tagId null quando nada casa (não inventa Tag)", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo, { listTags: listTagsFake });

    const result = await svc.suggest({
      userId: "u1",
      description: "transferência interna",
    });
    expect(result.tagId).toBeNull();
  });
});

describe("createSuggested", () => {
  it("sem type explícito, infere type e aplica a Tag sugerida na criação", async () => {
    const { repo, rows, grantTag } = fakeRepo();
    // A Tag sugerida (tag-academia) precisa estar "owned" no fake — no mundo
    // real, toda Tag devolvida por listTags pertence ao usuário por construção.
    grantTag("u1", "tag-academia");
    const svc = makeService(repo, { listTags: listTagsFake });

    const result = await svc.createSuggested({
      userId: "u1",
      description: "mensalidade da academia",
      amount: 90,
      date: "2026-06-10",
      source: "agent",
    });

    expect(result.duplicated).toBe(false);
    expect(result.transaction.type).toBe("saida");
    expect(result.transaction.tags.map((t) => t.id)).toEqual(["tag-academia"]);
    expect(rows).toHaveLength(1);
  });

  it("com type explícito, prevalece sobre a inferência", async () => {
    const { repo } = fakeRepo();
    const svc = makeService(repo, { listTags: listTagsFake });

    const result = await svc.createSuggested({
      userId: "u1",
      description: "Salário", // inferiria entrada
      amount: 5000,
      date: "2026-06-10",
      type: "entrada",
    });

    expect(result.transaction.type).toBe("entrada");
  });

  it("sem Tag casando, cria sem conectar Tag", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo, { listTags: listTagsFake });

    const result = await svc.createSuggested({
      userId: "u1",
      description: "transferência interna",
      amount: 50,
      date: "2026-06-10",
    });

    expect(result.transaction.tags).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("propaga duplicata: mesma janela/type+amount retorna candidata sem criar", async () => {
    const { repo, rows } = fakeRepo();
    const svc = makeService(repo, { listTags: listTagsFake });
    await svc.createSuggested({
      userId: "u1",
      description: "Mercado",
      amount: 100,
      date: "2026-06-10",
      force: true,
    });

    const dup = await svc.createSuggested({
      userId: "u1",
      description: "Compra no mercado",
      amount: 100,
      date: "2026-06-11", // dentro de ±2 dias
    });

    expect(dup.duplicated).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("aceita recorrência (repeat) pelo mesmo contrato do create", async () => {
    const { repo, rows, grantTag } = fakeRepo();
    grantTag("u1", "tag-moradia"); // "Aluguel" casa a categoria Moradia
    const svc = makeService(repo, { listTags: listTagsFake });

    await svc.createSuggested({
      userId: "u1",
      description: "Aluguel",
      amount: 1500,
      date: "2026-06-10",
      repeat: "monthly",
      repeatEnd: "count",
      repeatCount: 3,
      force: true,
    });

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.date.getMonth())).toEqual([5, 6, 7]);
  });
});
