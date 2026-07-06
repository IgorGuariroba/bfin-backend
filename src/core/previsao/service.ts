import type { PrevisaoRepo } from "./ports.js";
import type { NewDiario, Previsao } from "./types.js";
import { saoPauloTodayRange } from "../dates.js";

export class PrevisaoValidationError extends Error {}
export class PrevisaoNotFoundError extends Error {}

// typeof NaN === "number" — sem o guard extra, NaN persistiria no banco.
function isValidAmount(amount: unknown): amount is number {
  return typeof amount === "number" && !Number.isNaN(amount);
}

export function makePrevisaoService(repo: PrevisaoRepo) {
  /** Lista as Previsões do usuário (ordenação: name asc — contrato da porta). */
  async function listPrevisoes(userId: string): Promise<Previsao[]> {
    return repo.listByUser(userId);
  }

  async function createPrevisao(input: {
    userId: string;
    name: string;
    amount: number;
  }): Promise<Previsao> {
    if (!input.name || !isValidAmount(input.amount)) {
      throw new PrevisaoValidationError("Invalid data");
    }
    return repo.create(input);
  }

  /**
   * Edita name/amount (patch parcial). Sempre escopado ao próprio userId
   * (anti-IDOR) — id de outro dono é indistinguível de inexistente.
   */
  async function updatePrevisao(input: {
    userId: string;
    id: string;
    name?: string;
    amount?: number;
  }): Promise<Previsao> {
    const { userId, id, name, amount } = input;
    if (name !== undefined && !name) {
      throw new PrevisaoValidationError("Invalid data");
    }
    if (amount !== undefined && !isValidAmount(amount)) {
      throw new PrevisaoValidationError("Invalid data");
    }
    const existing = await repo.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new PrevisaoNotFoundError("Not found or unauthorized");
    }
    return repo.update(id, {
      ...(name !== undefined && { name }),
      ...(amount !== undefined && { amount }),
    });
  }

  /** Remove uma Previsão. Mesmo anti-IDOR do update: id de outro dono vira not found. */
  async function deletePrevisao(userId: string, id: string): Promise<void> {
    const existing = await repo.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new PrevisaoNotFoundError("Not found or unauthorized");
    }
    await repo.delete(id);
  }

  /**
   * Materializa a Previsão diária como projeção (CONTEXT.md › Previsão): um
   * diario "Previsão Diária" por dia na janela de 12 meses a partir de hoje.
   * Destrutivo: deleta antes os diario manuais na janela — nunca importados
   * (contrato da porta). Retorna quantos placeholders foram criados.
   */
  async function applyPrevisao(
    input: { userId: string; amount: number },
    now: Date = new Date(),
  ): Promise<{ count: number }> {
    const { userId, amount } = input;
    if (!isValidAmount(amount)) {
      throw new PrevisaoValidationError("Invalid parameters");
    }

    const startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
    );
    const endDate = new Date(
      now.getFullYear(),
      now.getMonth() + 12,
      now.getDate(),
      0,
      0,
      0,
    );

    await repo.deleteManualDiario(userId, { gte: startDate, lt: endDate });

    const rows: NewDiario[] = [];
    const cursor = new Date(startDate);
    while (cursor < endDate) {
      rows.push({
        userId,
        description: "Previsão Diária",
        amount: Math.abs(amount),
        // Meio-dia em hora local do servidor (igual a parseTransactionDay). Em prod
        // o container roda UTC → 12:00Z, o que dá ~12h de folga das bordas da janela
        // da baixa automática (saoPauloTodayRange/ADR-0005 §7). A invariante "diário
        // ao meio-dia UTC" da baixa depende desse deploy em UTC.
        date: new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          12,
          0,
          0,
        ),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    await repo.createDiarios(rows);

    return { count: rows.length };
  }

  /**
   * Baixa automática do gasto diário (ADR-0005): exclui a projeção cujo dia é
   * "hoje" em America/Sao_Paulo dos usuários pro que optaram. Escopo deliberado:
   * só o dia corrente — não recupera dias passados nem futuros. Elegibilidade e
   * atomicidade (delete único filtrado pela relação) são contrato da porta.
   */
  async function baixaDiaria(
    now: Date = new Date(),
  ): Promise<{ count: number }> {
    const window = saoPauloTodayRange(now);
    const count = await repo.deleteManualDiarioForAutoBaixa(window, now);
    return { count };
  }

  return {
    listPrevisoes,
    createPrevisao,
    updatePrevisao,
    deletePrevisao,
    applyPrevisao,
    baixaDiaria,
  };
}

export type PrevisaoService = ReturnType<typeof makePrevisaoService>;
