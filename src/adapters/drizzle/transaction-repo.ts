import { and, asc, count, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { tag, tagToTransaction, transaction } from "../../db/schema.js";
import {
  TransactionNotFoundError,
  type DateRange,
  type Transaction,
  type TransactionRepo,
  type TransactionTag,
  type TransactionWithTags,
} from "../../core/transactions/index.js";
import { newId } from "./id.js";
import { fromDbTimestamp, toDbTimestamp } from "./timestamp.js";

type TransactionRow = typeof transaction.$inferSelect;
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    description: row.description,
    amount: row.amount,
    date: fromDbTimestamp(row.date),
    repeat: row.repeat,
    repeatEnd: row.repeatEnd,
    repeatCount: row.repeatCount,
    createdAt: fromDbTimestamp(row.createdAt),
    updatedAt: fromDbTimestamp(row.updatedAt),
    source: row.source,
    externalId: row.externalId,
    pluggyItemId: row.pluggyItemId,
  };
}

// Busca as tags de um lote de Transactions numa única query (join na tabela de
// junção implícita `_TagToTransaction`) — substitui o `include` do Prisma, que
// não existe em Drizzle.
async function attachTags(rows: TransactionRow[]): Promise<TransactionWithTags[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const tagRows = await db
    .select({ transactionId: tagToTransaction.b, id: tag.id, name: tag.name, color: tag.color })
    .from(tagToTransaction)
    .innerJoin(tag, eq(tag.id, tagToTransaction.a))
    .where(inArray(tagToTransaction.b, ids));

  const byTx = new Map<string, TransactionTag[]>();
  for (const t of tagRows) {
    const list = byTx.get(t.transactionId) ?? [];
    list.push({ id: t.id, name: t.name, color: t.color });
    byTx.set(t.transactionId, list);
  }

  return rows.map((row) => ({ ...mapRow(row), tags: byTx.get(row.id) ?? [] }));
}

function dateConditions(date: DateRange | undefined) {
  if (!date) return [];
  const conditions = [];
  if (date.gte) conditions.push(gte(transaction.date, toDbTimestamp(date.gte)));
  if (date.lt) conditions.push(lt(transaction.date, toDbTimestamp(date.lt)));
  if (date.lte) conditions.push(lte(transaction.date, toDbTimestamp(date.lte)));
  return conditions;
}

// Substitui o `tags: { connect }` do Prisma: insere os pares na tabela de
// junção para cada combinação transactionId x tagId. Recebe `db` ou `tx` para
// poder rodar dentro da mesma transação da escrita da Transaction.
async function connectTags(client: DbOrTx, transactionIds: string[], tagIds: string[]) {
  if (transactionIds.length === 0 || tagIds.length === 0) return;
  await client
    .insert(tagToTransaction)
    .values(transactionIds.flatMap((txId) => tagIds.map((tagId) => ({ a: tagId, b: txId }))))
    .onConflictDoNothing();
}

export const drizzleTransactionRepo: TransactionRepo = {
  list: async ({ userId, type, tagId, date }, take) => {
    const conditions = [eq(transaction.userId, userId), ...dateConditions(date)];
    if (type) conditions.push(eq(transaction.type, type));
    if (tagId) {
      // Subquery em vez de duas queries + IN em memória: evita carregar todos
      // os ids da tag no Node e estourar o limite de parâmetros do Postgres
      // (65535) quando a tag tem muitas transações.
      conditions.push(
        inArray(
          transaction.id,
          db.select({ id: tagToTransaction.b }).from(tagToTransaction).where(eq(tagToTransaction.a, tagId))
        )
      );
    }

    const rows = await db
      .select()
      .from(transaction)
      .where(and(...conditions))
      .orderBy(asc(transaction.date))
      .limit(take);
    return attachTags(rows);
  },

  findDuplicate: async (userId, type, amount, window) => {
    const rows = await db
      .select()
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, userId),
          eq(transaction.type, type),
          eq(transaction.amount, amount),
          gte(transaction.date, toDbTimestamp(window.gte)),
          lte(transaction.date, toDbTimestamp(window.lte))
        )
      )
      .orderBy(asc(transaction.date))
      .limit(1);
    const [result] = await attachTags(rows);
    return result ?? null;
  },

  countOwnedTags: async (userId, tagIds) => {
    if (tagIds.length === 0) return 0;
    const [row] = await db
      .select({ count: count() })
      .from(tag)
      .where(and(eq(tag.userId, userId), inArray(tag.id, tagIds)));
    return row.count;
  },

  create: async (data, tagIds) => {
    const id = newId();
    const now = toDbTimestamp(new Date());
    // Transação de banco: se o insert das tags falhar, a Transaction não fica
    // órfã sem tags (igual à garantia que o `tags: { connect }` do Prisma dava
    // de graça via nested write).
    const row = await db.transaction(async (tx) => {
      const [newRow] = await tx
        .insert(transaction)
        .values({
          id,
          userId: data.userId,
          type: data.type,
          description: data.description,
          amount: data.amount,
          date: toDbTimestamp(data.date),
          source: data.source,
          repeat: data.repeat,
          repeatEnd: data.repeatEnd,
          repeatCount: data.repeatCount,
          updatedAt: now,
        })
        .returning();
      if (tagIds?.length) await connectTags(tx, [id], tagIds);
      return newRow;
    });
    const [result] = await attachTags([row]);
    return result;
  },

  createMany: async (data, tagIds) => {
    if (data.length === 0) return;
    const now = toDbTimestamp(new Date());
    const rows = data.map((d) => ({
      id: newId(),
      userId: d.userId,
      type: d.type,
      description: d.description,
      amount: d.amount,
      date: toDbTimestamp(d.date),
      source: d.source,
      repeat: d.repeat,
      repeatEnd: d.repeatEnd,
      repeatCount: d.repeatCount,
      updatedAt: now,
    }));
    await db.transaction(async (tx) => {
      const created = await tx.insert(transaction).values(rows).returning({ id: transaction.id });
      if (tagIds?.length) await connectTags(tx, created.map((r) => r.id), tagIds);
    });
  },

  findById: async (id) => {
    const [row] = await db.select().from(transaction).where(eq(transaction.id, id));
    return row ? mapRow(row) : null;
  },

  update: async (id, patch, tagIds) => {
    const set: Partial<TransactionRow> = { updatedAt: toDbTimestamp(new Date()) };
    if (patch.type !== undefined) set.type = patch.type;
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.amount !== undefined) set.amount = patch.amount;
    if (patch.date !== undefined) set.date = toDbTimestamp(patch.date);

    // Transação de banco: sem ela, um insert de tag falho depois do delete
    // deixaria a Transaction sem nenhuma tag (perda de dado), já que o
    // `tags: { set }` do Prisma dava essa atomicidade de graça.
    const row = await db.transaction(async (tx) => {
      const [updatedRow] = await tx.update(transaction).set(set).where(eq(transaction.id, id)).returning();
      // O service sempre chama update() após um findById() bem-sucedido;
      // updatedRow só fica undefined numa corrida (delete concorrente entre
      // as duas chamadas). Sem esse guard, connectTags() estouraria FK e
      // attachTags() um TypeError.
      if (!updatedRow) {
        throw new TransactionNotFoundError(`Transaction ${id} not found`);
      }

      // `undefined` = não mexe nas tags; `[]` = desconecta todas (set vazio) —
      // substitui o conjunto por completo, igual ao `tags: { set }` do Prisma.
      if (tagIds !== undefined) {
        await tx.delete(tagToTransaction).where(eq(tagToTransaction.b, id));
        if (tagIds.length) await connectTags(tx, [id], tagIds);
      }

      return updatedRow;
    });

    const [result] = await attachTags([row]);
    return result;
  },

  deleteOwned: async (userId, id) => {
    const deleted = await db
      .delete(transaction)
      .where(and(eq(transaction.id, id), eq(transaction.userId, userId)))
      .returning({ id: transaction.id });
    return deleted.length > 0;
  },
};
