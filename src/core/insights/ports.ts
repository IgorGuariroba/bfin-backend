import type { Movement } from "./types.js";

/** Intervalo de datas [gte, lt) — gte ausente = desde o início da conta. */
export interface MovementRange {
  gte?: Date;
  lt: Date;
}

/**
 * Porta de leitura do agregado Insights (ADR-0013). Insights só agrega — não
 * escreve nada; o contrato é moldado pelas três leituras que os cálculos
 * precisam, não um CRUD genérico.
 */
export interface InsightsRepo {
  /** Somatório de amount por type das Transactions do usuário no intervalo. */
  sumByType(userId: string, range: MovementRange): Promise<Record<string, number>>;
  /** Movimentos do usuário no intervalo. Contrato de ordenação: date ascendente. */
  listMovements(userId: string, range: { gte: Date; lt: Date }): Promise<Movement[]>;
  /** Soma total das Previsões do usuário (projeção mensal de gasto variável). */
  sumPrevisoes(userId: string): Promise<number>;
}
