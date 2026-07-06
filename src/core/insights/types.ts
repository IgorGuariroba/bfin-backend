// Tipos de domínio do agregado Insights (ADR-0013) — escritos à mão, nunca
// derivados do client do ORM.

/** Movimento mínimo que os insights precisam de uma Transaction. */
export interface Movement {
  type: string;
  amount: number;
  date: Date;
}

export type SugestaoTipo =
  "saldo_negativo" | "diario_acima" | "economia_baixa" | "custo_subiu";

export interface Sugestao {
  tipo: SugestaoTipo;
  severidade: "alerta" | "info";
  texto: string;
}

export interface MonthSummary {
  month: string; // YYYY-MM
  entradas: number;
  saidas: number;
  cartao: number;
  diarios: number;
  economia: number;
  custoVida: number;
  /** Quanto sobrou da renda após o custo de vida no mês (= performance). */
  sobrouNoMes: number;
  saldoAnterior: number;
  saldoAtual: number;
  diarioMedio: number;
  diarioPrev: number;
}

export interface SaldoDia {
  day: number;
  date: string; // YYYY-MM-DD
  byType: Record<string, number>;
  accSaldo: number;
}

export interface SaldosResult {
  entries: SaldoDia[];
  prevByType: Record<string, number>;
}

export interface TotaisResult {
  entradas: number;
  saidas: number;
  diarios: number;
  cartao: number;
  economia: number;
  custoVida: number;
  performance: number;
  saldoAnterior: number;
  saldoAtual: number;
  diarioMedio: number;
  diarioPrev: number;
  previsaoTotal: number;
  daysInMonth: number;
  daysElapsed: number;
  prevMonth: {
    saldoAtual: number;
    custoVida: number;
    diarioMedio: number;
    economiaPct: number;
  } | null;
}
