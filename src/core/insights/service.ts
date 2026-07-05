import type { InsightsRepo } from "./ports.js";
import type { MonthSummary, SaldoDia, SaldosResult, Sugestao, TotaisResult } from "./types.js";

export class InsightsValidationError extends Error {}

// Formatação BRL dos textos de Sugestao. Duplica o fmt de @/lib/utils de
// propósito: o core não importa @/lib (ADR-0013) e Intl é padrão da linguagem.
const fmt = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

/** Parseia "YYYY-MM" em [year, month(1-12)], rejeitando formato/valor inválido. */
function parseMonth(month: string): [number, number] {
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
    throw new InsightsValidationError("Invalid month. Expected YYYY-MM");
  }
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon || mon < 1 || mon > 12) {
    throw new InsightsValidationError("Invalid month");
  }
  return [year, mon];
}

const ECONOMIA_PCT_MINIMA = 10; // abaixo disso, sinaliza economia baixa

const TYPE_ZEROS: Record<string, number> = {
  entrada: 0,
  saida: 0,
  diario: 0,
  cartao: 0,
  economia: 0,
};

/** Saldo líquido de um agrupamento por type — economia não entra (é reserva, não custo). */
function netSaldo(byType: Record<string, number>): number {
  return (
    (byType.entrada ?? 0) -
    (byType.saida ?? 0) -
    (byType.diario ?? 0) -
    (byType.cartao ?? 0)
  );
}

export function makeInsightsService(
  repo: InsightsRepo,
  deps: { now?: () => Date } = {}
) {
  const now = deps.now ?? (() => new Date());

  /**
   * Agregação financeira de um mês (totais por tipo, custo de vida, performance,
   * saldo acumulado e comparação com o mês anterior). Compartilhado por REST e
   * MCP. Não decide entitlement (gate de plano fica na borda HTTP) — só computa
   * dado um userId + mês.
   */
  async function getTotais(userId: string, month: string): Promise<TotaisResult> {
    const [year, mon] = parseMonth(month);

    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);
    const daysInMonth = new Date(year, mon, 0).getDate();

    const prevMonStart = new Date(year, mon - 2, 1);
    const prevDaysInMonth = new Date(year, mon - 1, 0).getDate();

    const [monthByType, previsaoTotal, prevByType, prevMonByType] = await Promise.all([
      repo.sumByType(userId, { gte: start, lt: end }),
      repo.sumPrevisoes(userId),
      repo.sumByType(userId, { lt: start }),
      repo.sumByType(userId, { gte: prevMonStart, lt: start }),
    ]);

    const totals = { ...TYPE_ZEROS, ...monthByType };
    const saldoAnterior = netSaldo(prevByType);

    const custoVida = totals.saida + totals.cartao + totals.diario;
    const performance = totals.entrada - custoVida;

    const today = now();
    const isCurrentMonth =
      today.getFullYear() === year && today.getMonth() + 1 === mon;
    const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;

    const diarioMedio = daysElapsed > 0 ? totals.diario / daysElapsed : 0;
    const diarioPrev = daysInMonth > 0 ? previsaoTotal / daysInMonth : 0;

    const prevTotals = { ...TYPE_ZEROS, ...prevMonByType };
    const prevCustoVida = prevTotals.saida + prevTotals.cartao + prevTotals.diario;
    const prevPerformance = prevTotals.entrada - prevCustoVida;
    const prevDiarioMedio = prevDaysInMonth > 0 ? prevTotals.diario / prevDaysInMonth : 0;
    const prevEconomiaPct =
      prevTotals.entrada > 0
        ? Math.min(100, Math.round((prevTotals.economia / prevTotals.entrada) * 100))
        : 0;
    // Registro vazio = nenhum movimento no mês anterior (sem grupo por type).
    const hasPrevData = Object.keys(prevMonByType).length > 0;

    return {
      entradas: totals.entrada,
      saidas: totals.saida,
      diarios: totals.diario,
      cartao: totals.cartao,
      economia: totals.economia,
      custoVida,
      performance,
      saldoAnterior,
      saldoAtual: saldoAnterior + performance,
      diarioMedio,
      diarioPrev,
      previsaoTotal,
      daysInMonth,
      daysElapsed,
      prevMonth: hasPrevData
        ? {
            saldoAtual: prevPerformance,
            custoVida: prevCustoVida,
            diarioMedio: prevDiarioMedio,
            economiaPct: prevEconomiaPct,
          }
        : null,
    };
  }

  /**
   * Evolução do saldo acumulado dia a dia no mês, partindo do saldo herdado dos
   * meses anteriores (prevByType). economia não entra no saldo (é reserva, não
   * custo de vida).
   */
  async function getSaldos(userId: string, month: string): Promise<SaldosResult> {
    const [year, mon] = parseMonth(month);

    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    const [prevByType, movements] = await Promise.all([
      repo.sumByType(userId, { lt: start }),
      repo.listMovements(userId, { gte: start, lt: end }),
    ]);

    const daysCount = new Date(year, mon, 0).getDate();
    const byDay: Record<number, Record<string, number>> = {};
    for (let d = 1; d <= daysCount; d++) byDay[d] = {};

    for (const m of movements) {
      const day = m.date.getDate();
      byDay[day][m.type] = (byDay[day][m.type] ?? 0) + m.amount;
    }

    let accSaldo = netSaldo(prevByType);
    const entries: SaldoDia[] = [];

    for (let d = 1; d <= daysCount; d++) {
      const bt = byDay[d];
      accSaldo += netSaldo(bt);

      entries.push({
        day: d,
        date: `${year}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        byType: bt,
        accSaldo,
      });
    }

    return { entries, prevByType };
  }

  /**
   * Resumo agent-friendly do mês: uma chamada responde "quanto sobrou este mês".
   * Compõe getTotais e expõe o subconjunto relevante para conversa, com o campo
   * sobrouNoMes nomeando a performance (renda − custo de vida).
   */
  async function getMonthSummary(userId: string, month: string): Promise<MonthSummary> {
    const t = await getTotais(userId, month);
    return {
      month,
      entradas: t.entradas,
      saidas: t.saidas,
      cartao: t.cartao,
      diarios: t.diarios,
      economia: t.economia,
      custoVida: t.custoVida,
      sobrouNoMes: t.performance,
      saldoAnterior: t.saldoAnterior,
      saldoAtual: t.saldoAtual,
      diarioMedio: t.diarioMedio,
      diarioPrev: t.diarioPrev,
    };
  }

  /**
   * Insights financeiros proativos derivados dos totais do mês (regras heurísticas).
   * Cada regra acionada vira uma Sugestao com texto pronto para o agente repassar.
   * Lista vazia = nada digno de nota — não força conselho onde não há sinal.
   */
  async function getSugestoes(userId: string, month: string): Promise<Sugestao[]> {
    const t = await getTotais(userId, month);
    const sugestoes: Sugestao[] = [];

    if (t.saldoAtual < 0) {
      sugestoes.push({
        tipo: "saldo_negativo",
        severidade: "alerta",
        texto: `Seu saldo do mês está negativo em ${fmt(t.saldoAtual)}. As saídas superaram o que você tinha disponível.`,
      });
    }

    if (t.diarioPrev > 0 && t.diarioMedio > t.diarioPrev) {
      sugestoes.push({
        tipo: "diario_acima",
        severidade: "alerta",
        texto: `Seu gasto diário está em ${fmt(t.diarioMedio)}/dia, acima da Previsão de ${fmt(t.diarioPrev)}/dia.`,
      });
    }

    if (t.entradas > 0) {
      const economiaPct = Math.round((t.economia / t.entradas) * 100);
      if (economiaPct < ECONOMIA_PCT_MINIMA) {
        sugestoes.push({
          tipo: "economia_baixa",
          severidade: "info",
          texto: `Você guardou ${economiaPct}% da renda este mês — abaixo de ${ECONOMIA_PCT_MINIMA}%. Considere reservar um pouco mais.`,
        });
      }
    }

    if (t.prevMonth && t.custoVida > t.prevMonth.custoVida) {
      const delta = t.custoVida - t.prevMonth.custoVida;
      sugestoes.push({
        tipo: "custo_subiu",
        severidade: "info",
        texto: `Seu custo de vida subiu ${fmt(delta)} em relação ao mês anterior (${fmt(t.prevMonth.custoVida)} → ${fmt(t.custoVida)}).`,
      });
    }

    return sugestoes;
  }

  return { getTotais, getSaldos, getMonthSummary, getSugestoes };
}

export type InsightsService = ReturnType<typeof makeInsightsService>;
