import { describe, it, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { tag, tagToTransaction, transaction, user as userTable } from "../../db/schema.js";
import { fromDbTimestamp, toDbTimestamp } from "./timestamp.js";
import { transactionsService } from "../index.js";
import {
  MAX_LIST_RESULTS,
  TransactionNotFoundError,
  TransactionValidationError,
} from "../../core/transactions/index.js";
import { drizzleTransactionRepo } from "./transaction-repo.js";
import { trackCreatedUsers } from "./test-helpers.js";

// A suíte antecede a extração do core (ADR-0013) e chama as operações como
// funções soltas; o service composto preserva o contrato — só o import mudou.
const { createTransaction, updateTransaction, deleteTransaction, listTransactions } =
  transactionsService;

const trackUser = trackCreatedUsers();

async function seedUser() {
  const [row] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Test User",
      email: `test-${crypto.randomUUID()}@example.com`,
      plan: "pro",
    })
    .returning();
  trackUser(row.id);
  return row;
}

async function seedTag(userId: string, name: string, color: string) {
  const [row] = await db.insert(tag).values({ id: crypto.randomUUID(), userId, name, color }).returning();
  return row;
}

async function seedTransaction(data: {
  userId: string;
  type: string;
  description: string;
  amount: number;
  date: Date;
  source?: string;
  externalId?: string;
}) {
  const now = toDbTimestamp(new Date());
  const [row] = await db
    .insert(transaction)
    .values({
      id: crypto.randomUUID(),
      userId: data.userId,
      type: data.type,
      description: data.description,
      amount: data.amount,
      date: toDbTimestamp(data.date),
      source: data.source ?? "manual",
      externalId: data.externalId,
      updatedAt: now,
    })
    .returning();
  return { ...row, date: fromDbTimestamp(row.date) };
}

async function findTransaction(id: string) {
  const [row] = await db.select().from(transaction).where(eq(transaction.id, id));
  return row ? { ...row, date: fromDbTimestamp(row.date) } : null;
}

async function findTransactions(userId: string) {
  const rows = await db.select().from(transaction).where(eq(transaction.userId, userId));
  return rows.map((r) => ({ ...r, date: fromDbTimestamp(r.date) }));
}

async function countTransactions(userId: string) {
  return (await findTransactions(userId)).length;
}

async function tagsOf(transactionId: string) {
  return db
    .select({ id: tag.id, name: tag.name, color: tag.color })
    .from(tagToTransaction)
    .innerJoin(tag, eq(tag.id, tagToTransaction.a))
    .where(eq(tagToTransaction.b, transactionId));
}

async function transactionsWithTag(userId: string, tagId: string) {
  return db
    .select({ id: transaction.id })
    .from(transaction)
    .innerJoin(tagToTransaction, eq(tagToTransaction.b, transaction.id))
    .where(and(eq(transaction.userId, userId), eq(tagToTransaction.a, tagId)));
}

describe("transactions-service create", () => {
  it("cria uma Transaction válida e persiste no banco", async () => {
    const user = await seedUser();

    const { transaction: tx } = await createTransaction({
      userId: user.id,
      type: "entrada",
      description: "Salário",
      amount: 5000,
      date: "2026-06-10",
    });

    const stored = await findTransaction(tx.id);
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(user.id);
    expect(stored?.type).toBe("entrada");
    expect(stored?.description).toBe("Salário");
    expect(stored?.amount).toBe(5000);
  });

  it("usa source 'manual' por padrão", async () => {
    const user = await seedUser();

    const { transaction: tx } = await createTransaction({
      userId: user.id,
      type: "entrada",
      description: "Salário",
      amount: 5000,
      date: "2026-06-10",
    });

    expect(tx.source).toBe("manual");
  });

  it("grava source 'agent' quando criada pelo assistente", async () => {
    const user = await seedUser();

    const { transaction: tx } = await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Mercado",
      amount: 120,
      date: "2026-06-10",
      source: "agent",
    });

    expect(tx.source).toBe("agent");
  });

  it("rejeita type inválido e não cria nada", async () => {
    const user = await seedUser();

    await expect(
      createTransaction({
        userId: user.id,
        type: "investimento",
        description: "X",
        amount: 10,
        date: "2026-06-10",
      })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    expect(await countTransactions(user.id)).toBe(0);
  });

  it("rejeita type 'diario' no create (reservado à projeção — ADR-0004)", async () => {
    const user = await seedUser();

    await expect(
      createTransaction({
        userId: user.id,
        type: "diario",
        description: "Gasto",
        amount: 10,
        date: "2026-06-10",
      })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    expect(await countTransactions(user.id)).toBe(0);
  });

  it("rejeita amount não-positivo", async () => {
    const user = await seedUser();

    await expect(
      createTransaction({
        userId: user.id,
        type: "saida",
        description: "X",
        amount: 0,
        date: "2026-06-10",
      })
    ).rejects.toBeInstanceOf(TransactionValidationError);
  });

  it("rejeita date malformada em vez de gravar Invalid Date", async () => {
    const user = await seedUser();

    await expect(
      createTransaction({
        userId: user.id,
        type: "saida",
        description: "X",
        amount: 10,
        date: "não-é-data",
      })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    expect(await countTransactions(user.id)).toBe(0);
  });

  it("rejeita date não-string (número/objeto) como Missing required fields, sem TypeError", async () => {
    const user = await seedUser();

    // Input externo (API/MCP) pode chegar como número se a validação de borda
    // falhar; o serviço deve rejeitar como 400, não estourar TypeError (500).
    await expect(
      createTransaction({
        userId: user.id,
        type: "saida",
        description: "X",
        amount: 10,
        date: 20260610 as unknown as string,
      })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    expect(await countTransactions(user.id)).toBe(0);
  });

  it("rejeita data impossível que o JS rolaria (formato válido, mas inexistente)", async () => {
    const user = await seedUser();

    // 2026-13-45: mês/dia fora do range — o JS "rola" para uma data válida,
    // mas não é o que o caller pediu. O round-trip precisa rejeitar.
    await expect(
      createTransaction({
        userId: user.id,
        type: "saida",
        description: "X",
        amount: 10,
        date: "2026-13-45",
      })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    // 2026-02-30: 30 de fevereiro vira 02 de março.
    await expect(
      createTransaction({
        userId: user.id,
        type: "saida",
        description: "X",
        amount: 10,
        date: "2026-02-30",
      })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    expect(await countTransactions(user.id)).toBe(0);
  });

  it("parseia date YYYY-MM-DD no dia correto (sem off-by-one)", async () => {
    const user = await seedUser();

    const { transaction: tx } = await createTransaction({
      userId: user.id,
      type: "entrada",
      description: "Salário",
      amount: 5000,
      date: "2026-06-10",
    });

    expect(tx.date.getFullYear()).toBe(2026);
    expect(tx.date.getMonth()).toBe(5); // junho (0-indexed)
    expect(tx.date.getDate()).toBe(10);
  });

  it("gera ocorrências extras quando repeat é mensal com count", async () => {
    const user = await seedUser();

    await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Aluguel",
      amount: 2000,
      date: "2026-06-10",
      repeat: "monthly",
      repeatEnd: "count",
      repeatCount: 3,
    });

    const all = (await findTransactions(user.id)).sort((a, b) => a.date.getTime() - b.date.getTime());
    expect(all).toHaveLength(3);
    expect(all.map((t) => t.date.getMonth())).toEqual([5, 6, 7]); // jun, jul, ago
  });

  it("associa tags só às ocorrências novas, sem contaminar transações pré-existentes coincidentes", async () => {
    const user = await seedUser();
    const tagRow = await seedTag(user.id, "Casa", "#abc");

    // Transação pré-existente que coincide em userId/description/type e data
    // com uma das ocorrências futuras do repeat — NÃO deve receber a tag.
    const preexisting = await seedTransaction({
      userId: user.id,
      type: "saida",
      description: "Aluguel",
      amount: 2000,
      date: new Date(2026, 6, 10, 12, 0, 0), // 2026-07-10 12:00
    });

    await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Aluguel",
      amount: 2000,
      date: "2026-06-10",
      repeat: "monthly",
      repeatEnd: "count",
      repeatCount: 3,
      tagIds: [tagRow.id],
    });

    const tagged = await transactionsWithTag(user.id, tagRow.id);
    expect(tagged).toHaveLength(3); // base + 2 extras, nenhuma a mais

    const refreshedPreTags = await tagsOf(preexisting.id);
    expect(refreshedPreTags).toHaveLength(0);
  });

  it("rejeita tagIds de outro usuário (anti-IDOR) e não cria nada", async () => {
    const owner = await seedUser();
    const attacker = await seedUser();
    // Tag pertencente ao owner — o attacker não pode conectá-la.
    const foreignTag = await seedTag(owner.id, "Privada", "#abc");

    await expect(
      createTransaction({
        userId: attacker.id,
        type: "saida",
        description: "X",
        amount: 10,
        date: "2026-06-10",
        tagIds: [foreignTag.id],
      })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    expect(await countTransactions(attacker.id)).toBe(0);
  });

  it("aceita tagIds duplicados (deduplica) e conecta a tag uma única vez", async () => {
    const user = await seedUser();
    const tagRow = await seedTag(user.id, "Casa", "#abc");

    const { transaction: tx } = await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Aluguel",
      amount: 2000,
      date: "2026-06-10",
      tagIds: [tagRow.id, tagRow.id], // duplicado: não deve falhar como "Invalid tags"
    });

    const stored = await tagsOf(tx.id);
    expect(stored.map((t) => t.id)).toEqual([tagRow.id]);
  });
});

describe("createTransaction — dedup defensivo (ADR-0004)", () => {
  it("T1: sem force, retorna a candidata existente (duplicated) e não cria linha nova", async () => {
    const user = await seedUser();
    // Candidata pré-existente: mesmo amount + mesmo dia + mesmo type.
    const existing = await seedTransaction({
      userId: user.id,
      type: "saida",
      description: "Uber",
      amount: 30,
      date: new Date(2026, 5, 10, 12, 0, 0), // 2026-06-10
    });

    const result = await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Uber",
      amount: 30,
      date: "2026-06-10",
    });

    expect(result.duplicated).toBe(true);
    expect(result.transaction.id).toBe(existing.id);
    expect(await countTransactions(user.id)).toBe(1); // nenhuma linha nova
  });

  it("T2: com force=true, cria nova transação mesmo havendo candidata", async () => {
    const user = await seedUser();
    await seedTransaction({
      userId: user.id,
      type: "saida",
      description: "Uber",
      amount: 30,
      date: new Date(2026, 5, 10, 12, 0, 0),
    });

    const result = await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Uber",
      amount: 30,
      date: "2026-06-10",
      force: true,
    });

    expect(result.duplicated).toBe(false);
    expect(await countTransactions(user.id)).toBe(2);
  });

  it("T3: janela de ±2 dias — 1 e 2 dias casam; 3 dias não", async () => {
    const user = await seedUser();
    const seed = (dayOffset: number) =>
      seedTransaction({
        userId: user.id,
        type: "saida",
        description: "Gasto",
        amount: 50,
        date: new Date(2026, 5, 10 + dayOffset, 12, 0, 0),
      });

    // +1 dia → candidata
    const near1 = await seed(1);
    let r = await createTransaction({ userId: user.id, type: "saida", description: "Outro", amount: 50, date: "2026-06-10" });
    expect(r.duplicated).toBe(true);
    expect(r.transaction.id).toBe(near1.id);
    await db.delete(transaction).where(eq(transaction.userId, user.id));

    // +2 dias → candidata (limite inclusivo)
    const near2 = await seed(2);
    r = await createTransaction({ userId: user.id, type: "saida", description: "Outro", amount: 50, date: "2026-06-10" });
    expect(r.duplicated).toBe(true);
    expect(r.transaction.id).toBe(near2.id);
    await db.delete(transaction).where(eq(transaction.userId, user.id));

    // +3 dias → NÃO é candidata → cria normal
    await seed(3);
    r = await createTransaction({ userId: user.id, type: "saida", description: "Outro", amount: 50, date: "2026-06-10" });
    expect(r.duplicated).toBe(false);
    expect(await countTransactions(user.id)).toBe(2); // a de +3 dias + a recém-criada
  });

  it("T4: type ou amount diferente não é candidata → cria normal", async () => {
    const user = await seedUser();
    await seedTransaction({ userId: user.id, type: "saida", description: "Uber", amount: 30, date: new Date(2026, 5, 10, 12, 0, 0) });

    // type diferente
    let r = await createTransaction({ userId: user.id, type: "entrada", description: "Uber", amount: 30, date: "2026-06-10" });
    expect(r.duplicated).toBe(false);

    // amount diferente
    r = await createTransaction({ userId: user.id, type: "saida", description: "Uber", amount: 31, date: "2026-06-10" });
    expect(r.duplicated).toBe(false);

    expect(await countTransactions(user.id)).toBe(3); // 1 pré-existente + 2 criadas
  });

  it("T5: cross-source — candidata pluggy é casada por create do agente", async () => {
    const user = await seedUser();
    const pluggy = await seedTransaction({
      userId: user.id,
      type: "saida",
      description: "Mercado",
      amount: 120,
      date: new Date(2026, 5, 10, 12, 0, 0),
      source: "pluggy",
      externalId: "pluggy-xyz",
    });

    const r = await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Mercado",
      amount: 120,
      date: "2026-06-10",
      source: "agent",
    });

    expect(r.duplicated).toBe(true);
    expect(r.transaction.id).toBe(pluggy.id);
    expect(await countTransactions(user.id)).toBe(1);
  });
});

describe("updateTransaction", () => {
  it("edita os campos de uma Transaction existente e persiste", async () => {
    const user = await seedUser();
    const { transaction: tx } = await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Mercado",
      amount: 120,
      date: "2026-06-10",
    });

    const updated = await updateTransaction({
      userId: user.id,
      id: tx.id,
      description: "Mercado do mês",
      amount: 150,
    });

    expect(updated.description).toBe("Mercado do mês");
    expect(updated.amount).toBe(150);

    const stored = await findTransaction(tx.id);
    expect(stored?.description).toBe("Mercado do mês");
    expect(stored?.amount).toBe(150);
    expect(stored?.type).toBe("saida"); // campos não enviados ficam intactos
  });

  it("anti-IDOR: não edita Transaction de outro usuário e não a muta", async () => {
    const owner = await seedUser();
    const attacker = await seedUser();
    const { transaction: tx } = await createTransaction({
      userId: owner.id,
      type: "saida",
      description: "Privado",
      amount: 100,
      date: "2026-06-10",
    });

    await expect(
      updateTransaction({
        userId: attacker.id,
        id: tx.id,
        description: "Hackeado",
      })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    const stored = await findTransaction(tx.id);
    expect(stored?.description).toBe("Privado"); // intacta
  });

  it("rejeita type/amount/date inválidos sem mutar a transação", async () => {
    const user = await seedUser();
    const { transaction: tx } = await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Mercado",
      amount: 120,
      date: "2026-06-10",
    });

    await expect(
      updateTransaction({ userId: user.id, id: tx.id, type: "investimento" })
    ).rejects.toBeInstanceOf(TransactionValidationError);
    // `diario` é reservado à projeção (apply_previsao) — o boundary rejeita
    // mesmo sendo um Transaction Type válido (ADR-0004 §4).
    await expect(
      updateTransaction({ userId: user.id, id: tx.id, type: "diario" })
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      updateTransaction({ userId: user.id, id: tx.id, amount: 0 })
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      updateTransaction({ userId: user.id, id: tx.id, date: "2026-02-30" })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    const stored = await findTransaction(tx.id);
    expect(stored?.type).toBe("saida");
    expect(stored?.amount).toBe(120);
  });

  it("anti-IDOR de tags: rejeita tagIds de outro usuário", async () => {
    const owner = await seedUser();
    const attacker = await seedUser();
    const foreignTag = await seedTag(owner.id, "Privada", "#abc");
    const { transaction: tx } = await createTransaction({
      userId: attacker.id,
      type: "saida",
      description: "X",
      amount: 10,
      date: "2026-06-10",
    });

    await expect(
      updateTransaction({ userId: attacker.id, id: tx.id, tagIds: [foreignTag.id] })
    ).rejects.toBeInstanceOf(TransactionValidationError);
  });

  it("substitui o conjunto de tags (set) quando tagIds é enviado", async () => {
    const user = await seedUser();
    const tagA = await seedTag(user.id, "A", "#a");
    const tagB = await seedTag(user.id, "B", "#b");
    const { transaction: tx } = await createTransaction({
      userId: user.id,
      type: "saida",
      description: "X",
      amount: 10,
      date: "2026-06-10",
      tagIds: [tagA.id],
    });

    const updated = await updateTransaction({
      userId: user.id,
      id: tx.id,
      tagIds: [tagB.id],
    });

    expect(updated.tags.map((t) => t.id)).toEqual([tagB.id]);
  });

  it("update no repo direto rejeita com TransactionNotFoundError para id inexistente", async () => {
    await expect(
      drizzleTransactionRepo.update(crypto.randomUUID(), { description: "X" })
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
  });
});

describe("deleteTransaction", () => {
  it("remove fisicamente a Transaction pelo identificador", async () => {
    const user = await seedUser();
    const { transaction: tx } = await createTransaction({
      userId: user.id,
      type: "saida",
      description: "Erro",
      amount: 10,
      date: "2026-06-10",
    });

    await deleteTransaction(user.id, tx.id);

    expect(await findTransaction(tx.id)).toBeNull();
  });

  it("anti-IDOR: não deleta Transaction de outro usuário", async () => {
    const owner = await seedUser();
    const attacker = await seedUser();
    const { transaction: tx } = await createTransaction({
      userId: owner.id,
      type: "saida",
      description: "Privado",
      amount: 100,
      date: "2026-06-10",
    });

    await expect(
      deleteTransaction(attacker.id, tx.id)
    ).rejects.toBeInstanceOf(TransactionValidationError);

    expect(await findTransaction(tx.id)).not.toBeNull(); // intacta
  });
});

describe("listTransactions", () => {
  it("filtra por mês, ignorando transações de outros meses", async () => {
    const user = await seedUser();
    await seedTransaction({ userId: user.id, type: "saida", description: "Maio", amount: 10, date: new Date(2026, 4, 20, 12) });
    await seedTransaction({ userId: user.id, type: "saida", description: "Junho A", amount: 20, date: new Date(2026, 5, 10, 12) });
    await seedTransaction({ userId: user.id, type: "saida", description: "Junho B", amount: 30, date: new Date(2026, 5, 25, 12) });
    await seedTransaction({ userId: user.id, type: "saida", description: "Julho", amount: 40, date: new Date(2026, 6, 1, 12) });

    const result = await listTransactions(user.id, { month: "2026-06" });

    expect(result.map((t) => t.description)).toEqual(["Junho A", "Junho B"]);
  });

  it("filtra por type", async () => {
    const user = await seedUser();
    await seedTransaction({ userId: user.id, type: "saida", description: "Gasto", amount: 20, date: new Date(2026, 5, 10, 12) });
    await seedTransaction({ userId: user.id, type: "entrada", description: "Renda", amount: 500, date: new Date(2026, 5, 11, 12) });

    const result = await listTransactions(user.id, { month: "2026-06", type: "entrada" });

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Renda");
  });

  it("filtra por Tag e inclui as tags na resposta", async () => {
    const user = await seedUser();
    const tagRow = await seedTag(user.id, "Transporte", "#fff");
    const withTag = await seedTransaction({ userId: user.id, type: "saida", description: "Uber", amount: 30, date: new Date(2026, 5, 10, 12) });
    await db.insert(tagToTransaction).values({ a: tagRow.id, b: withTag.id });
    await seedTransaction({ userId: user.id, type: "saida", description: "Sem tag", amount: 15, date: new Date(2026, 5, 11, 12) });

    const result = await listTransactions(user.id, { tagId: tagRow.id });

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Uber");
    expect(result[0].tags.map((t) => t.name)).toEqual(["Transporte"]);
  });

  it("rejeita month malformado com TransactionValidationError (não estoura Prisma/500)", async () => {
    const user = await seedUser();
    await expect(
      listTransactions(user.id, { month: "garbage" })
    ).rejects.toBeInstanceOf(TransactionValidationError);
    // mês fora de 01-12 também é inválido
    await expect(
      listTransactions(user.id, { month: "2026-13" })
    ).rejects.toBeInstanceOf(TransactionValidationError);
  });

  it("rejeita from/to malformado com TransactionValidationError", async () => {
    const user = await seedUser();
    await expect(
      listTransactions(user.id, { from: "ontem" })
    ).rejects.toBeInstanceOf(TransactionValidationError);
    await expect(
      listTransactions(user.id, { to: "2026-02-31" })
    ).rejects.toBeInstanceOf(TransactionValidationError);
  });

  // Timeout maior: são MAX_LIST_RESULTS+5 inserts sequenciais — sob o
  // paralelismo do suite completo, os 5s default estouram.
  it("corta no teto MAX_LIST_RESULTS quando há mais registros que o limite", async () => {
    const user = await seedUser();
    for (let i = 0; i < MAX_LIST_RESULTS + 5; i++) {
      await seedTransaction({ userId: user.id, type: "saida", description: `Gasto ${i}`, amount: 1, date: new Date(2026, 5, 10, 12) });
    }

    const result = await listTransactions(user.id, {});

    expect(result).toHaveLength(MAX_LIST_RESULTS);
  }, 30_000);

  it("não vaza transações de outro usuário", async () => {
    const user = await seedUser();
    const other = await seedUser();
    await seedTransaction({ userId: other.id, type: "saida", description: "Alheia", amount: 99, date: new Date(2026, 5, 10, 12) });

    const result = await listTransactions(user.id, { month: "2026-06" });

    expect(result).toHaveLength(0);
  });
});
