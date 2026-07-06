import type { DateRange, TransactionPatch, TransactionRepo } from "./ports.js";
import type { TransactionWithTags } from "./types.js";
import { addDays, addWeeks, addMonths } from "../dates.js";

export class TransactionValidationError extends Error {}

/**
 * Subtipo de TransactionValidationError, não classe irmã: preserva o mapeamento
 * dos consumidores que já tratam validação (REST → 400, MCP → tool error) e
 * permite ao handler REST de /api/transactions/[id] capturá-lo antes para 404.
 */
export class TransactionNotFoundError extends TransactionValidationError {}

const VALID_TYPES = ["entrada", "saida", "diario", "cartao", "economia"];

// Tipos que uma escrita de usuário/agente (create/update) pode atribuir. Exclui
// `diario`: é o placeholder da projeção, criado só por apply_previsao — deixar o
// boundary aceitá-lo abriria uma Transaction real a ser apagada por um futuro
// deleteMany de apply_previsao (ADR-0004 §4, CONTEXT.md › Transaction Type).
const VALID_WRITE_TYPES = VALID_TYPES.filter((t) => t !== "diario");

/**
 * Parseia uma data YYYY-MM-DD de Transaction ao meio-dia local (evita off-by-one
 * de fuso). Round-trip rejeita formato e datas impossíveis (ex.: 2026-02-30) com
 * TransactionValidationError. Compartilhado por create e update.
 */
function parseTransactionDay(s: string): Date {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new TransactionValidationError(
      "Invalid date format. Expected YYYY-MM-DD",
    );
  }
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    throw new TransactionValidationError("Invalid date");
  }
  return date;
}

/**
 * Parseia um limite YYYY-MM-DD do filtro, rejeitando formato/datas impossíveis
 * (round-trip) com TransactionValidationError — evita Invalid Date chegando ao
 * adapter como 500. endOfDay=true fixa o fim do dia (limite superior inclusivo).
 */
function parseFilterDay(s: string, endOfDay = false): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new TransactionValidationError(
      "Invalid date format. Expected YYYY-MM-DD",
    );
  }
  const [y, m, d] = s.split("-").map(Number);
  const date = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    throw new TransactionValidationError("Invalid date");
  }
  return date;
}

export interface ListTransactionsFilter {
  month?: string; // YYYY-MM — atalho para o intervalo do mês inteiro
  type?: string;
  tagId?: string;
  from?: string; // YYYY-MM-DD (ignorado se month presente)
  to?: string; // YYYY-MM-DD (ignorado se month presente)
}

/**
 * Teto de resultados do listTransactions: proteção de borda contra resposta
 * ilimitada (sem filtro de data ela cresce com a vida do usuário). Paginação
 * completa fica fora de escopo — ao atingir o teto o corte é logado.
 */
export const MAX_LIST_RESULTS = 1000;

/** Observabilidade mínima que o core conhece — o composition root injeta o logger real. */
export interface CoreLogger {
  warn(data: Record<string, unknown>, msg: string): void;
}

export interface CreateTransactionInput {
  userId: string;
  type: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  source?: "manual" | "agent";
  repeat?: string;
  repeatEnd?: string;
  repeatCount?: number;
  tagIds?: string[];
  force?: boolean; // true = cria mesmo havendo candidata duplicata (ADR-0004)
}

export interface CreateTransactionResult {
  transaction: TransactionWithTags; // criada OU candidata duplicata existente (com tags)
  duplicated: boolean; // true = retornou candidata em vez de criar
}

export interface UpdateTransactionInput {
  userId: string;
  id: string;
  type?: string;
  description?: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  tagIds?: string[];
}

function buildRepeatDates(
  base: Date,
  repeat: string,
  repeatEnd: string,
  count: number,
): Date[] {
  const dates: Date[] = [];
  const maxOccurrences = repeatEnd === "count" ? count - 1 : 12;
  const advance =
    repeat === "daily" ? addDays : repeat === "weekly" ? addWeeks : addMonths;

  for (let i = 1; i <= maxOccurrences; i++) {
    dates.push(advance(base, i));
  }
  return dates;
}

export function makeTransactionsService(
  repo: TransactionRepo,
  deps: { logger?: CoreLogger } = {},
) {
  const logger = deps.logger ?? { warn: () => {} };

  /**
   * Lista as Transactions do usuário aplicando filtros (mês/type/Tag ou intervalo
   * from/to). Sempre escopado ao próprio userId (anti-IDOR). Compartilhado por
   * REST e MCP.
   */
  async function listTransactions(
    userId: string,
    filter: ListTransactionsFilter = {},
  ): Promise<TransactionWithTags[]> {
    const { month, type, tagId, from, to } = filter;
    let date: DateRange | undefined;

    if (month) {
      // Valida antes de instanciar Date: um month malformado viraria Invalid Date
      // e estouraria como 500 no adapter.
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new TransactionValidationError(
          "Invalid month format. Expected YYYY-MM",
        );
      }
      const [year, mon] = month.split("-").map(Number);
      date = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) };
    } else if (from || to) {
      date = {
        ...(from ? { gte: parseFilterDay(from) } : {}),
        ...(to ? { lte: parseFilterDay(to, true) } : {}),
      };
    }

    // +1 para distinguir "exatamente o teto" de "havia mais registros".
    const rows = await repo.list(
      { userId, type, tagId, date },
      MAX_LIST_RESULTS + 1,
    );

    if (rows.length > MAX_LIST_RESULTS) {
      logger.warn(
        { userId, filter, max: MAX_LIST_RESULTS },
        "listTransactions truncado no teto de resultados",
      );
      return rows.slice(0, MAX_LIST_RESULTS);
    }

    return rows;
  }

  async function createTransaction(
    input: CreateTransactionInput,
  ): Promise<CreateTransactionResult> {
    const { userId, type, description, amount, source = "manual" } = input;

    if (
      !type ||
      !description ||
      amount == null ||
      typeof input.date !== "string" ||
      !input.date
    ) {
      throw new TransactionValidationError("Missing required fields");
    }
    if (!VALID_WRITE_TYPES.includes(type)) {
      throw new TransactionValidationError("Invalid type");
    }
    if (typeof amount !== "number" || amount <= 0) {
      throw new TransactionValidationError("amount must be positive number");
    }

    const baseDate = parseTransactionDay(input.date);

    // Anti-IDOR (styleguide §39): só conecta tags que pertencem ao próprio userId.
    // Sem isso, um caller poderia anexar a Tag de outro usuário (input do body é cru).
    // Deduplica antes de validar: IDs repetidos fariam o count divergir do length.
    const tagIds = input.tagIds?.length
      ? [...new Set(input.tagIds)]
      : undefined;
    if (tagIds?.length) {
      const owned = await repo.countOwnedTags(userId, tagIds);
      if (owned !== tagIds.length) {
        throw new TransactionValidationError("Invalid tags");
      }
    }

    // Dedup defensivo (ADR-0004): candidata = mesmo amount + data ±2 dias + mesmo
    // type, cruzando qualquer origem. Sem force, retorna a existente.
    if (!input.force) {
      const candidate = await repo.findDuplicate(userId, type, amount, {
        gte: addDays(baseDate, -2),
        lte: addDays(baseDate, 2),
      });
      if (candidate) {
        return { transaction: candidate, duplicated: true };
      }
    }

    const repeat = input.repeat ?? "none";
    const repeatEnd = input.repeatEnd ?? "forever";
    const repeatCount = input.repeatCount ?? 0;
    const common = {
      userId,
      type,
      description,
      amount,
      source,
      repeat,
      repeatEnd,
      repeatCount,
    };

    const base = await repo.create({ ...common, date: baseDate }, tagIds);

    if (repeat !== "none") {
      const extras = buildRepeatDates(baseDate, repeat, repeatEnd, repeatCount);
      await repo.createMany(
        extras.map((d) => ({ ...common, date: d })),
        tagIds,
      );
    }

    return { transaction: base, duplicated: false };
  }

  /**
   * Edita os campos centrais de uma Transaction (patch parcial). Sempre escopado
   * ao próprio userId (anti-IDOR) — id de outro dono é indistinguível de
   * inexistente (TransactionNotFoundError). Reaproveita as validações do create
   * para os campos enviados; campos omitidos ficam intactos. `type=diario` só é
   * aceito se a transaction já é diario (a UI reenvia o type ao editar um
   * placeholder) — transição para diario nunca, senão a Transaction real ficaria
   * exposta ao deleteMany do apply_previsao (ADR-0004 §4). A trilha de auditoria
   * (log + bump de lastUsedAt) é responsabilidade do chamador MCP (recordAgentWrite).
   */
  async function updateTransaction(
    input: UpdateTransactionInput,
  ): Promise<TransactionWithTags> {
    const { userId, id } = input;
    if (!userId || !id) {
      throw new TransactionValidationError("Missing required fields");
    }

    // Posse antes de validar type: a regra do diario depende do type atual.
    const existing = await repo.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new TransactionNotFoundError("Transaction not found");
    }

    const patch: TransactionPatch = {};

    if (input.type !== undefined) {
      const keepsDiario = input.type === "diario" && existing.type === "diario";
      if (!VALID_WRITE_TYPES.includes(input.type) && !keepsDiario) {
        throw new TransactionValidationError("Invalid type");
      }
      patch.type = input.type;
    }

    if (input.description !== undefined) {
      if (!input.description) {
        throw new TransactionValidationError("Missing required fields");
      }
      patch.description = input.description;
    }

    if (input.amount !== undefined) {
      if (typeof input.amount !== "number" || input.amount <= 0) {
        throw new TransactionValidationError("amount must be positive number");
      }
      patch.amount = input.amount;
    }

    if (input.date !== undefined) {
      patch.date = parseTransactionDay(input.date);
    }

    let tagIds: string[] | undefined;
    if (input.tagIds !== undefined) {
      tagIds = input.tagIds.length ? [...new Set(input.tagIds)] : [];
      if (tagIds.length) {
        const owned = await repo.countOwnedTags(userId, tagIds);
        if (owned !== tagIds.length) {
          throw new TransactionValidationError("Invalid tags");
        }
      }
    }

    return repo.update(id, patch, tagIds);
  }

  /**
   * Remove fisicamente uma Transaction (irreversível — ADR-0004). Escopado ao
   * próprio userId (anti-IDOR): id de outro dono não casa e vira not found.
   */
  async function deleteTransaction(userId: string, id: string): Promise<void> {
    if (!userId || !id) {
      throw new TransactionValidationError("Missing required fields");
    }
    const deleted = await repo.deleteOwned(userId, id);
    if (!deleted) {
      throw new TransactionNotFoundError("Transaction not found");
    }
  }

  return {
    listTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}

export type TransactionsService = ReturnType<typeof makeTransactionsService>;
