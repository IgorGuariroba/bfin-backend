import type { AutoBaixaCandidate, NewDiario, Previsao } from "./types.js";

export interface PrevisaoPatch {
  name?: string;
  amount?: number;
}

/**
 * Porta de persistência do agregado Previsão (ADR-0013). Além do CRUD dos itens
 * de Previsão, cobre a projeção de gasto diário (Transactions type=diario) — o
 * lado destrutivo do agregado (apply_previsao e baixa automática). O contrato é
 * moldado pelo que o service precisa — não é um CRUD genérico.
 */
export interface PrevisaoRepo {
  /** Contrato de ordenação: name ascendente. */
  listByUser(userId: string): Promise<Previsao[]>;
  create(data: {
    userId: string;
    name: string;
    amount: number;
  }): Promise<Previsao>;
  findById(id: string): Promise<Previsao | null>;
  update(id: string, patch: PrevisaoPatch): Promise<Previsao>;
  delete(id: string): Promise<void>;

  /**
   * Deleta os `diario` do usuário com source=manual na janela [gte, lt).
   * Nunca toca importados (source=pluggy/agent) nem outros types
   * (CONTEXT.md › Previsão; ADR-0004 §4).
   */
  deleteManualDiario(
    userId: string,
    window: { gte: Date; lt: Date },
  ): Promise<void>;
  /** Persiste os placeholders da projeção (type=diario, source=manual). */
  createDiarios(rows: NewDiario[]): Promise<void>;
  /**
   * Usuários com autoBaixaDiario=true, com plan/planExpiresAt crus. Só dados —
   * a elegibilidade (pro vigente) é regra do service (baixaDiaria).
   */
  listAutoBaixaCandidates(): Promise<AutoBaixaCandidate[]>;
  /**
   * Deleta os `diario` com source=manual na janela [gte, lt) dos usuários
   * dados (um único delete). Retorna o total deletado.
   */
  deleteManualDiarioForUsers(
    userIds: string[],
    window: { gte: Date; lt: Date },
  ): Promise<number>;
}
