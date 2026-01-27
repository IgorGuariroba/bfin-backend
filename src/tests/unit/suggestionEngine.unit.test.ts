import { beforeEach, describe, expect, it, vi } from 'vitest';

type RedisMockInstance = {
  get: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

const redisStore = new Map<string, string>();
let redisInstance: RedisMockInstance;

class RedisMock {
  constructor() {
    redisInstance = {
      get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
      setex: vi.fn(async (key: string, _ttl: number, value: string) => {
        redisStore.set(key, value);
        return 'OK';
      }),
      del: vi.fn(async (key: string) => {
        redisStore.delete(key);
        return 1;
      }),
      on: vi.fn(),
    };

    return redisInstance;
  }
}

type PrismaMock = {
  account: { findUnique: ReturnType<typeof vi.fn> };
  spendingSuggestion: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  transaction: { aggregate: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
};

let prismaMock: PrismaMock;

async function loadEngine() {
  vi.resetModules();

  prismaMock = {
    account: { findUnique: vi.fn() },
    spendingSuggestion: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: { aggregate: vi.fn() },
    $queryRaw: vi.fn(),
  };

  vi.doMock('ioredis', () => ({
    default: RedisMock,
  }));

  vi.doMock('../../lib/prisma', () => ({
    default: prismaMock,
  }));

  const module = await import('../../services/SuggestionEngine');
  return module.SuggestionEngine;
}

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
});

describe('SuggestionEngine (unit)', () => {
  it('returns cached daily limit when available', async () => {
    const SuggestionEngine = await loadEngine();

    const cached = {
      accountId: 'acc-1',
      dailyLimit: 10,
      availableBalance: 300,
      daysConsidered: 30,
      calculatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    };

    redisStore.set('daily-limit:acc-1', JSON.stringify(cached));

    const result = await SuggestionEngine.calculateDailyLimit('acc-1');

    expect(result.dailyLimit).toBe(10);
    expect(result.calculatedAt).toBeInstanceOf(Date);
    expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
  });

  it('calculates and caches daily limit when cache is empty', async () => {
    const SuggestionEngine = await loadEngine();

    prismaMock.account.findUnique.mockResolvedValue({
      id: 'acc-2',
      available_balance: 600,
      locked_balance: 0,
      user_id: 'user-1',
    });

    prismaMock.spendingSuggestion.create.mockResolvedValue({ id: 'sug-1' });

    const result = await SuggestionEngine.calculateDailyLimit('acc-2');

    expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
      where: { id: 'acc-2' },
      select: {
        id: true,
        available_balance: true,
        locked_balance: true,
        user_id: true,
      },
    });
    expect(prismaMock.spendingSuggestion.create).toHaveBeenCalled();
    expect(redisInstance.setex).toHaveBeenCalled();
    expect(result.dailyLimit).toBeCloseTo(20);
    expect(result.availableBalance).toBe(600);
  });

  it('throws when account does not exist', async () => {
    const SuggestionEngine = await loadEngine();

    prismaMock.account.findUnique.mockResolvedValue(null);

    await expect(SuggestionEngine.calculateDailyLimit('missing')).rejects.toThrow(
      'Account not found'
    );
  });

  it('validates days range for spending history', async () => {
    const SuggestionEngine = await loadEngine();

    await expect(SuggestionEngine.getSpendingHistory('acc-3', 0)).rejects.toThrow(
      'Days must be between 1 and 30'
    );
    await expect(SuggestionEngine.getSpendingHistory('acc-3', 31)).rejects.toThrow(
      'Days must be between 1 and 30'
    );
  });

  it('returns cached spending history when available', async () => {
    const SuggestionEngine = await loadEngine();

    const cached = {
      accountId: 'acc-4',
      days: 7,
      history: [],
      totalSpent: 0,
      averageDailySpent: 0,
      daysWithSpending: 0,
    };

    redisStore.set('spending-history:acc-4:7', JSON.stringify(cached));

    const result = await SuggestionEngine.getSpendingHistory('acc-4', 7);

    expect(result).toEqual(cached);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('computes spending history, statuses and caches the response', async () => {
    const SuggestionEngine = await loadEngine();

    prismaMock.$queryRaw.mockResolvedValue([
      { date: new Date('2026-01-10T12:00:00.000Z'), spent: 50 },
      { date: new Date('2026-01-09T12:00:00.000Z'), spent: 0 },
      { date: new Date('2026-01-08T12:00:00.000Z'), spent: 90 },
    ]);

    prismaMock.spendingSuggestion.findMany.mockResolvedValue([
      { daily_limit: 100, created_at: new Date('2026-01-10T08:00:00.000Z') },
      { daily_limit: 80, created_at: new Date('2026-01-08T08:00:00.000Z') },
    ]);

    prismaMock.account.findUnique.mockResolvedValue({
      id: 'acc-5',
      available_balance: 300,
      locked_balance: 0,
      user_id: 'user-2',
    });
    prismaMock.spendingSuggestion.create.mockResolvedValue({ id: 'sug-2' });

    const result = await SuggestionEngine.getSpendingHistory('acc-5', 7);

    expect(result.history).toHaveLength(2);
    expect(result.history[0].status).toBe('ok');
    expect(result.history[1].status).toBe('exceeded');
    expect(result.totalSpent).toBe(140);
    expect(redisInstance.setex).toHaveBeenCalledWith(
      'spending-history:acc-5:7',
      3600,
      expect.any(String)
    );
  });

  it('recalculates daily limit by invalidating cache', async () => {
    const SuggestionEngine = await loadEngine();

    prismaMock.account.findUnique.mockResolvedValue({
      id: 'acc-6',
      available_balance: 90,
      locked_balance: 0,
      user_id: 'user-3',
    });
    prismaMock.spendingSuggestion.create.mockResolvedValue({ id: 'sug-3' });

    const result = await SuggestionEngine.recalculateDailyLimit('acc-6');

    expect(redisInstance.del).toHaveBeenCalledWith('daily-limit:acc-6');
    expect(prismaMock.account.findUnique).toHaveBeenCalled();
    expect(result.dailyLimit).toBeCloseTo(3);
  });

  it('maps suggestion history results', async () => {
    const SuggestionEngine = await loadEngine();

    prismaMock.spendingSuggestion.findMany.mockResolvedValue([
      {
        id: 's1',
        daily_limit: 12.5,
        available_balance_snapshot: 250,
        created_at: new Date('2026-01-05T10:00:00.000Z'),
      },
    ]);

    const history = await SuggestionEngine.getHistory('acc-7', 5);

    expect(prismaMock.spendingSuggestion.findMany).toHaveBeenCalledWith({
      where: { account_id: 'acc-7' },
      select: {
        id: true,
        daily_limit: true,
        available_balance_snapshot: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    });
    expect(history).toEqual([
      {
        id: 's1',
        dailyLimit: 12.5,
        availableBalance: 250,
        createdAt: new Date('2026-01-05T10:00:00.000Z'),
      },
    ]);
  });

  it('uses current limit as fallback and reports warning status', async () => {
    const SuggestionEngine = await loadEngine();

    prismaMock.$queryRaw.mockResolvedValue([
      { date: new Date('2026-01-12T12:00:00.000Z'), spent: 80 },
      { date: new Date('2026-01-11T12:00:00.000Z'), spent: 0 },
    ]);
    prismaMock.spendingSuggestion.findMany.mockResolvedValue([]);

    prismaMock.account.findUnique.mockResolvedValue({
      id: 'acc-8',
      available_balance: 3000,
      locked_balance: 0,
      user_id: 'user-4',
    });
    prismaMock.spendingSuggestion.create.mockResolvedValue({ id: 'sug-4' });

    const result = await SuggestionEngine.getSpendingHistory('acc-8', 7);

    expect(result.history).toHaveLength(1);
    expect(result.history[0].status).toBe('warning');
    expect(result.history[0].percentageUsed).toBeCloseTo(80);
  });

  it('returns zero for negative available balance', async () => {
    const SuggestionEngine = await loadEngine();

    prismaMock.account.findUnique.mockResolvedValue({
      id: 'acc-9',
      available_balance: -150,
      locked_balance: 0,
      user_id: 'user-5',
    });
    prismaMock.spendingSuggestion.create.mockResolvedValue({ id: 'sug-5' });

    const result = await SuggestionEngine.calculateDailyLimit('acc-9');

    expect(result.dailyLimit).toBe(0);
  });

  it('computes spent today and limit exceeded summary', async () => {
    const SuggestionEngine = await loadEngine();

    const dailyLimitSpy = vi.spyOn(SuggestionEngine, 'getDailyLimit').mockResolvedValue({
      accountId: 'acc-10',
      dailyLimit: 100,
      availableBalance: 100,
      daysConsidered: 30,
      calculatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const spentSpy = vi.spyOn(SuggestionEngine, 'getSpentToday').mockResolvedValue(120);

    const result = await SuggestionEngine.isLimitExceeded('acc-10');

    expect(dailyLimitSpy).toHaveBeenCalled();
    expect(spentSpy).toHaveBeenCalled();
    expect(result).toEqual({
      exceeded: true,
      dailyLimit: 100,
      spentToday: 120,
      remaining: 0,
      percentageUsed: 100,
    });
  });

  it('aggregates spent today from transactions', async () => {
    const SuggestionEngine = await loadEngine();

    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: { amount: 55.5 },
    });

    const spent = await SuggestionEngine.getSpentToday('acc-12');

    expect(prismaMock.transaction.aggregate).toHaveBeenCalled();
    expect(spent).toBe(55.5);
  });

  it('invalidates daily limit cache', async () => {
    const SuggestionEngine = await loadEngine();

    await SuggestionEngine.invalidateCache('acc-11');

    expect(redisInstance.del).toHaveBeenCalledWith('daily-limit:acc-11');
  });
});
