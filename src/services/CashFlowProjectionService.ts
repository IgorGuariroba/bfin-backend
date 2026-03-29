import { AccountMemberService } from './AccountMemberService';
import prisma from '../lib/prisma';
import { NotFoundError, ForbiddenError } from '../middlewares/errorHandler';

const accountMemberService = new AccountMemberService();

interface CategorySummary {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface TransactionSummary {
  id: string;
  description: string | null;
  amount: number;
  type: string;
  is_floating: boolean;
  status: string;
  category: CategorySummary | null;
}

interface DaySnapshot {
  date: string; // "YYYY-MM-DD"
  balance: number;
  remainingFloatingDebt: number;
  isNegative: boolean;
  dailyIncome: number;
  dailyExpenses: number;
  floatingDebtPayment: number;
  transactions: TransactionSummary[];
}

export interface MonthlyProjection {
  accountId: string;
  year: number;
  month: number;
  startBalance: number;
  endBalance: number;
  totalFloatingDebt: number;
  remainingFloatingDebtAtEnd: number;
  debtFreeDate: string | null;
  isHistorical: boolean;
  days: DaySnapshot[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDaysInRange(start: Date, end: Date): string[] {
  const days: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(toDateStr(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

const CATEGORY_INCLUDE = {
  category: { select: { id: true, name: true, color: true, icon: true } },
} as const;

type TxRow = Awaited<
  ReturnType<typeof prisma.transaction.findMany<{ include: typeof CATEGORY_INCLUDE }>>
>[number];

function toSummary(t: TxRow): TransactionSummary {
  return {
    id: t.id,
    description: t.description,
    amount: Number(t.amount),
    type: t.type,
    is_floating: t.is_floating,
    status: t.status,
    category: t.category ?? null,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class CashFlowProjectionService {
  /**
   * Retorna a projeção de saldo dia a dia para um mês.
   *
   * - Mês passado : reconstruído a partir do balance_history + transações executadas
   * - Mês atual   : dias passados = histórico real, dias futuros = projeção
   * - Mês futuro  : simulação completa a partir do saldo disponível atual
   *
   * Algoritmo por dia (projeção):
   *   1. Soma receitas pendentes com vencimento neste dia
   *   2. Subtrai despesas pendentes com vencimento neste dia
   *   3. Se sobrou saldo positivo e há dívidas flutuantes:
   *      abate min(saldo, dívida) — nunca mais do que o disponível
   */
  async getMonthlyProjection(
    userId: string,
    accountId: string,
    year: number,
    month: number
  ): Promise<MonthlyProjection> {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundError('Conta não encontrada');
    }

    const access = await accountMemberService.checkAccess(accountId, userId);
    if (!access.hasAccess) {
      throw new ForbiddenError('Acesso negado a esta conta');
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const isHistorical = monthEnd < todayUTC;

    if (isHistorical) {
      return this.buildHistoricalProjection(accountId, year, month, monthStart, monthEnd);
    }

    return this.buildFutureProjection(
      account,
      accountId,
      year,
      month,
      monthStart,
      monthEnd,
      todayUTC
    );
  }

  // ── Mês passado ─────────────────────────────────────────────────────────────
  private async buildHistoricalProjection(
    accountId: string,
    year: number,
    month: number,
    monthStart: Date,
    monthEnd: Date
  ): Promise<MonthlyProjection> {
    const priorSnapshot = await prisma.balanceHistory.findFirst({
      where: { account_id: accountId, recorded_at: { lt: monthStart } },
      orderBy: { recorded_at: 'desc' },
    });

    const monthSnapshots = await prisma.balanceHistory.findMany({
      where: { account_id: accountId, recorded_at: { gte: monthStart, lte: monthEnd } },
      orderBy: { recorded_at: 'asc' },
    });

    const executedTransactions = await prisma.transaction.findMany({
      where: {
        account_id: accountId,
        executed_date: { gte: monthStart, lte: monthEnd },
        status: 'executed',
      },
      include: CATEGORY_INCLUDE,
      orderBy: { executed_date: 'asc' },
    });

    let carryBalance = priorSnapshot ? Number(priorSnapshot.available_balance) : 0;
    const days: DaySnapshot[] = [];

    for (const dayStr of getDaysInRange(monthStart, monthEnd)) {
      const daySnapshots = monthSnapshots.filter((s) => toDateStr(s.recorded_at) === dayStr);
      const lastSnapshot = daySnapshots.at(-1);
      if (lastSnapshot) {
        carryBalance = Number(lastSnapshot.available_balance);
      }

      const dayTransactions = executedTransactions.filter(
        (t) => t.executed_date && toDateStr(t.executed_date) === dayStr
      );

      const dailyIncome = dayTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const dailyExpenses = dayTransactions
        .filter((t) => t.type !== 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      days.push({
        date: dayStr,
        balance: Math.round(carryBalance * 100) / 100,
        remainingFloatingDebt: 0,
        isNegative: carryBalance < 0,
        dailyIncome,
        dailyExpenses,
        floatingDebtPayment: 0,
        transactions: dayTransactions.map(toSummary),
      });
    }

    return {
      accountId,
      year,
      month,
      startBalance: days[0]?.balance ?? 0,
      endBalance: days.at(-1)?.balance ?? 0,
      totalFloatingDebt: 0,
      remainingFloatingDebtAtEnd: 0,
      debtFreeDate: null,
      isHistorical: true,
      days,
    };
  }

  // ── Mês atual ou futuro ──────────────────────────────────────────────────────
  private async buildFutureProjection(
    account: { available_balance: import('../generated/prisma/client').Prisma.Decimal },
    accountId: string,
    year: number,
    month: number,
    monthStart: Date,
    monthEnd: Date,
    todayUTC: Date
  ): Promise<MonthlyProjection> {
    // Buscar transações pendentes/locked até o fim do mês solicitado.
    // Inclui vencidas (due_date < hoje, status=pending) — serão aplicadas no dia de hoje.
    // Locked são excluídas de transações vencidas pois o saldo já foi bloqueado na criação.
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        account_id: accountId,
        is_floating: false,
        due_date: { lte: monthEnd },
        OR: [
          // Futuras (pending ou locked a partir de hoje)
          { status: { in: ['pending', 'locked'] }, due_date: { gte: todayUTC } },
          // Vencidas ainda não pagas (só pending — locked já está no available_balance)
          { status: 'pending', due_date: { lt: todayUTC } },
        ],
      },
      include: CATEGORY_INCLUDE,
      orderBy: { due_date: 'asc' },
    });

    // Dívidas flutuantes (sem data, status pending)
    const floatingDebts = await prisma.transaction.findMany({
      where: { account_id: accountId, is_floating: true, status: 'pending' },
      include: CATEGORY_INCLUDE,
      orderBy: { created_at: 'asc' },
    });

    const totalFloatingDebt = floatingDebts.reduce((sum, t) => sum + Number(t.amount), 0);
    let remainingFloatingDebt = totalFloatingDebt;
    let runningBalance = Number(account.available_balance);
    let debtFreeDate: string | null = null;

    const fullSimulation: DaySnapshot[] = [];

    const todayStr = toDateStr(todayUTC);

    for (const dayStr of getDaysInRange(todayUTC, monthEnd)) {
      const dayTransactions = pendingTransactions.filter((t) => {
        if (!t.due_date) {
          return false;
        }
        const txDay = toDateStr(t.due_date);
        // Transações vencidas (antes de hoje) são todas aplicadas no primeiro dia da simulação
        if (txDay < todayStr) {
          return dayStr === todayStr;
        }
        return txDay === dayStr;
      });

      // 1. Receitas do dia
      const dailyIncome = dayTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      runningBalance += dailyIncome;

      // 2. Despesas do dia
      const dailyExpenses = dayTransactions
        .filter((t) => t.type !== 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      runningBalance -= dailyExpenses;

      // 3. Abater dívidas flutuantes com excedente
      let floatingDebtPayment = 0;
      if (runningBalance > 0 && remainingFloatingDebt > 0) {
        floatingDebtPayment = Math.min(runningBalance, remainingFloatingDebt);
        runningBalance -= floatingDebtPayment;
        remainingFloatingDebt -= floatingDebtPayment;
        if (remainingFloatingDebt === 0 && debtFreeDate === null) {
          debtFreeDate = dayStr;
        }
      }

      fullSimulation.push({
        date: dayStr,
        balance: Math.round(runningBalance * 100) / 100,
        remainingFloatingDebt: Math.round(remainingFloatingDebt * 100) / 100,
        isNegative: runningBalance < 0,
        dailyIncome,
        dailyExpenses,
        floatingDebtPayment: Math.round(floatingDebtPayment * 100) / 100,
        transactions: dayTransactions.map(toSummary),
      });
    }

    // Apenas os dias do mês solicitado
    const monthStartStr = toDateStr(monthStart);
    const monthEndStr = toDateStr(monthEnd);
    const monthDays = fullSimulation.filter(
      (d) => d.date >= monthStartStr && d.date <= monthEndStr
    );

    // Dias passados do mês atual: usar histórico real
    const yesterday = new Date(todayUTC.getTime() - 86400000);
    const historicalDays =
      monthStart < todayUTC
        ? await this.buildHistoricalDaysForCurrentMonth(
            accountId,
            monthStart,
            monthEnd,
            yesterday,
            totalFloatingDebt,
            monthStartStr
          )
        : [];

    const allMonthDays = [...historicalDays, ...monthDays].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const lastDay = allMonthDays.at(-1);

    return {
      accountId,
      year,
      month,
      startBalance: allMonthDays[0]?.balance ?? Number(account.available_balance),
      endBalance: lastDay?.balance ?? Number(account.available_balance),
      totalFloatingDebt,
      remainingFloatingDebtAtEnd: lastDay?.remainingFloatingDebt ?? remainingFloatingDebt,
      debtFreeDate,
      isHistorical: false,
      days: allMonthDays,
    };
  }

  // ── Dias históricos do mês atual ─────────────────────────────────────────────
  private async buildHistoricalDaysForCurrentMonth(
    accountId: string,
    monthStart: Date,
    monthEnd: Date,
    yesterday: Date,
    totalFloatingDebt: number,
    monthStartStr: string
  ): Promise<DaySnapshot[]> {
    const pastEnd = new Date(Math.min(+yesterday, +monthEnd));

    const priorSnapshot = await prisma.balanceHistory.findFirst({
      where: { account_id: accountId, recorded_at: { lt: monthStart } },
      orderBy: { recorded_at: 'desc' },
    });

    const monthSnapshots = await prisma.balanceHistory.findMany({
      where: { account_id: accountId, recorded_at: { gte: monthStart, lte: pastEnd } },
      orderBy: { recorded_at: 'asc' },
    });

    const executedTransactions = await prisma.transaction.findMany({
      where: {
        account_id: accountId,
        executed_date: { gte: monthStart, lte: pastEnd },
        status: 'executed',
      },
      include: CATEGORY_INCLUDE,
      orderBy: { executed_date: 'asc' },
    });

    let carryBalance = priorSnapshot ? Number(priorSnapshot.available_balance) : 0;
    const historicalDays: DaySnapshot[] = [];

    for (const dayStr of getDaysInRange(monthStart, pastEnd)) {
      if (dayStr >= monthStartStr) {
        const daySnapshots = monthSnapshots.filter((s) => toDateStr(s.recorded_at) === dayStr);
        const lastSnapshot = daySnapshots.at(-1);
        if (lastSnapshot) {
          carryBalance = Number(lastSnapshot.available_balance);
        }

        const dayTransactions = executedTransactions.filter(
          (t) => t.executed_date && toDateStr(t.executed_date) === dayStr
        );

        historicalDays.push({
          date: dayStr,
          balance: Math.round(carryBalance * 100) / 100,
          remainingFloatingDebt: Math.round(totalFloatingDebt * 100) / 100,
          isNegative: carryBalance < 0,
          dailyIncome: dayTransactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0),
          dailyExpenses: dayTransactions
            .filter((t) => t.type !== 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0),
          floatingDebtPayment: 0,
          transactions: dayTransactions.map(toSummary),
        });
      }
    }

    return historicalDays;
  }
}
