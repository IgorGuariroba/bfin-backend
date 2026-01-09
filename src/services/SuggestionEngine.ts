import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface DailyLimitSuggestion {
  accountId: string;
  dailyLimit: number;
  availableBalance: number;
  daysConsidered: number;
  calculatedAt: Date;
}

interface SuggestionHistory {
  id: string;
  dailyLimit: number;
  availableBalance: number;
  createdAt: Date;
}

export interface DailySpendingHistory {
  date: string;
  dailyLimit: number;
  spent: number;
  percentageUsed: number;
  exceeded: boolean;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface SpendingHistoryResponse {
  accountId: string;
  days: number;
  history: DailySpendingHistory[];
  totalSpent: number;
  averageDailySpent: number;
  daysWithSpending: number;
}

export class SuggestionEngine {
  private static DAYS_FOR_CALCULATION = 30;
  private static CACHE_TTL_SECONDS = 86400; // 24 horas

  /**
   * Calcula o limite diário de gastos
   * Fórmula: Saldo Disponível / 30 dias
   */
  static async calculateDailyLimit(accountId: string): Promise<DailyLimitSuggestion> {
    // Verificar cache no Redis
    const cacheKey = `daily-limit:${accountId}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      const cached = JSON.parse(cachedData);
      return {
        ...cached,
        calculatedAt: new Date(cached.calculatedAt),
      };
    }

    // Buscar conta
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        available_balance: true,
        locked_balance: true,
        user_id: true,
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Converter Decimal para número
    const availableBalance = Number(account.available_balance);

    // Calcular limite diário
    const dailyLimit = availableBalance / this.DAYS_FOR_CALCULATION;

    const suggestion: DailyLimitSuggestion = {
      accountId: account.id,
      dailyLimit: Math.max(0, dailyLimit), // Não pode ser negativo
      availableBalance,
      daysConsidered: this.DAYS_FOR_CALCULATION,
      calculatedAt: new Date(),
    };

    // Salvar no banco de dados
    const now = new Date();
    const validUntil = new Date();
    validUntil.setHours(23, 59, 59, 999); // Válido até o final do dia

    await prisma.spendingSuggestion.create({
      data: {
        account_id: account.id,
        suggestion_date: now,
        valid_until: validUntil,
        daily_limit: dailyLimit,
        monthly_projection: dailyLimit * 30,
        available_balance_snapshot: availableBalance,
        locked_balance_snapshot: Number(account.locked_balance),
        days_until_next_income: this.DAYS_FOR_CALCULATION,
        average_daily_expense: null,
        calculation_metadata: {
          method: 'simple_division',
          formula: 'available_balance / 30',
        },
      },
    });

    // Cachear no Redis (24h)
    await redis.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(suggestion));

    return suggestion;
  }

  /**
   * Obtém o limite diário atual (do cache ou calcula)
   */
  static async getDailyLimit(accountId: string): Promise<DailyLimitSuggestion> {
    return this.calculateDailyLimit(accountId);
  }

  /**
   * Recalcula o limite diário (força atualização do cache)
   */
  static async recalculateDailyLimit(accountId: string): Promise<DailyLimitSuggestion> {
    // Invalidar cache
    const cacheKey = `daily-limit:${accountId}`;
    await redis.del(cacheKey);

    // Calcular novamente
    return this.calculateDailyLimit(accountId);
  }

  /**
   * Obtém o histórico de sugestões
   */
  static async getHistory(
    accountId: string,
    limit: number = 30
  ): Promise<SuggestionHistory[]> {
    const suggestions = await prisma.spendingSuggestion.findMany({
      where: { account_id: accountId },
      select: {
        id: true,
        daily_limit: true,
        available_balance_snapshot: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return suggestions.map((s) => ({
      id: s.id,
      dailyLimit: Number(s.daily_limit),
      availableBalance: Number(s.available_balance_snapshot),
      createdAt: s.created_at,
    }));
  }

  /**
   * Obtém o histórico de gastos diários com limite
   */
  static async getSpendingHistory(
    accountId: string,
    days: number = 7
  ): Promise<SpendingHistoryResponse> {
    // Validar parâmetros
    if (days < 1 || days > 30) {
      throw new Error('Days must be between 1 and 30');
    }

    // Verificar cache no Redis
    const cacheKey = `spending-history:${accountId}:${days}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Calcular date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Query 1: Agregar gastos diários
    const dailyExpenses = await prisma.$queryRaw<
      Array<{ date: Date; spent: any }>
    >`
      SELECT
        DATE(executed_date) as date,
        SUM(amount) as spent
      FROM transactions
      WHERE
        account_id = ${accountId}
        AND type = 'variable_expense'
        AND status = 'executed'
        AND executed_date >= ${startDate}
        AND executed_date <= ${endDate}
      GROUP BY DATE(executed_date)
      ORDER BY date DESC
    `;

    // Query 2: Buscar snapshots de limites diários
    const dailyLimitSnapshots = await prisma.spendingSuggestion.findMany({
      where: {
        account_id: accountId,
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        daily_limit: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // Obter limite diário atual como fallback
    const currentLimit = await this.getDailyLimit(accountId);

    // Criar mapa de limites por data
    const limitsByDate = new Map<string, number>();
    for (const snapshot of dailyLimitSnapshots) {
      const dateStr = snapshot.created_at.toISOString().split('T')[0];
      if (!limitsByDate.has(dateStr)) {
        limitsByDate.set(dateStr, Number(snapshot.daily_limit));
      }
    }

    // Combinar dados e calcular estatísticas
    const history: DailySpendingHistory[] = [];
    let totalSpent = 0;

    for (const expense of dailyExpenses) {
      const dateStr = new Date(expense.date).toISOString().split('T')[0];
      const spent = Number(expense.spent);

      // Filtrar apenas dias com gastos
      if (spent <= 0) continue;

      // Buscar limite do dia (snapshot ou fallback)
      let dailyLimit = limitsByDate.get(dateStr);

      // Se não encontrou snapshot exato, buscar o mais próximo anterior
      if (!dailyLimit) {
        const expenseDate = new Date(expense.date);
        let closestLimit = currentLimit.dailyLimit;

        for (const snapshot of dailyLimitSnapshots) {
          if (snapshot.created_at <= expenseDate) {
            closestLimit = Number(snapshot.daily_limit);
            break;
          }
        }

        dailyLimit = closestLimit;
      }

      const percentageUsed = dailyLimit > 0 ? (spent / dailyLimit) * 100 : 0;
      const exceeded = spent > dailyLimit;

      let status: 'ok' | 'warning' | 'exceeded';
      if (exceeded) {
        status = 'exceeded';
      } else if (percentageUsed >= 80) {
        status = 'warning';
      } else {
        status = 'ok';
      }

      history.push({
        date: dateStr,
        dailyLimit,
        spent,
        percentageUsed,
        exceeded,
        status,
      });

      totalSpent += spent;
    }

    // Calcular estatísticas
    const daysWithSpending = history.length;
    const averageDailySpent = daysWithSpending > 0 ? totalSpent / daysWithSpending : 0;

    const response: SpendingHistoryResponse = {
      accountId,
      days,
      history,
      totalSpent,
      averageDailySpent,
      daysWithSpending,
    };

    // Cachear no Redis (1 hora)
    await redis.setex(cacheKey, 3600, JSON.stringify(response));

    return response;
  }

  /**
   * Calcula quanto já foi gasto hoje
   */
  static async getSpentToday(accountId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expenses = await prisma.transaction.aggregate({
      where: {
        account_id: accountId,
        type: 'variable_expense',
        status: 'executed',
        executed_date: {
          gte: today,
          lt: tomorrow,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(expenses._sum.amount || 0);
  }

  /**
   * Verifica se o limite diário foi excedido
   */
  static async isLimitExceeded(accountId: string): Promise<{
    exceeded: boolean;
    dailyLimit: number;
    spentToday: number;
    remaining: number;
    percentageUsed: number;
  }> {
    const { dailyLimit } = await this.getDailyLimit(accountId);
    const spentToday = await this.getSpentToday(accountId);

    const remaining = dailyLimit - spentToday;
    const percentageUsed = dailyLimit > 0 ? (spentToday / dailyLimit) * 100 : 0;

    return {
      exceeded: spentToday > dailyLimit,
      dailyLimit,
      spentToday,
      remaining: Math.max(0, remaining),
      percentageUsed: Math.min(100, percentageUsed),
    };
  }

  /**
   * Invalidar cache após transação
   */
  static async invalidateCache(accountId: string): Promise<void> {
    const cacheKey = `daily-limit:${accountId}`;
    await redis.del(cacheKey);
  }
}
