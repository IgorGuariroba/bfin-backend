import { beforeEach, describe, expect, it, vi } from 'vitest';

type RedisPipelineMock = {
  del: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
};

type RedisMock = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  scanStream: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;
};

type PrismaAccountMock = {
  findUnique: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

type PrismaTransactionMock = {
  findUnique: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type PrismaMock = {
  $transaction: ReturnType<typeof vi.fn>;
  account: PrismaAccountMock;
  financialRule: { findMany: ReturnType<typeof vi.fn> };
  transaction: PrismaTransactionMock;
  balanceHistory: { create: ReturnType<typeof vi.fn> };
};

let redisMock: RedisMock;
let prismaMock: PrismaMock;
let txMock: PrismaMock;
let accessMock: { checkAccess: ReturnType<typeof vi.fn> };
let suggestionEngineMock: { invalidateCache: ReturnType<typeof vi.fn> };

async function loadService() {
  vi.resetModules();

  const pipelineMock: RedisPipelineMock = {
    del: vi.fn(),
    exec: vi.fn(),
  };

  redisMock = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scanStream: vi.fn(() => ({
      on: vi.fn((event: string, cb: (keys: string[]) => void) => {
        if (event === 'data') {
          cb(['calendar:acc-1:2026-01']);
        }
      }),
    })),
    pipeline: vi.fn(() => pipelineMock),
  };

  txMock = {
    $transaction: vi.fn(),
    account: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    financialRule: { findMany: vi.fn() },
    transaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    balanceHistory: { create: vi.fn() },
  };

  prismaMock = {
    $transaction: vi.fn(async (fn: (tx: PrismaMock) => unknown) => fn(txMock)),
    account: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    financialRule: { findMany: vi.fn() },
    transaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    balanceHistory: { create: vi.fn() },
  };

  accessMock = {
    checkAccess: vi.fn().mockResolvedValue({ hasAccess: true, role: 'owner' }),
  };

  suggestionEngineMock = {
    invalidateCache: vi.fn(),
  };

  class AccountMemberServiceMock {
    checkAccess = accessMock.checkAccess;
  }

  vi.doMock('../../lib/redis', () => ({
    default: redisMock,
  }));

  vi.doMock('../../lib/prisma', () => ({
    default: prismaMock,
  }));

  vi.doMock('../../services/AccountMemberService', () => ({
    AccountMemberService: AccountMemberServiceMock,
  }));

  vi.doMock('../../services/SuggestionEngine', () => ({
    SuggestionEngine: suggestionEngineMock,
  }));

  const module = await import('../../services/TransactionService');
  return module.TransactionService;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TransactionService (unit)', () => {
  it('validates positive amount for income before touching the database', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    await expect(
      service.processIncome('user-1', {
        accountId: 'acc-1',
        amount: 0,
        description: 'Invalid income',
        categoryId: 'cat-1',
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when income account does not exist', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValue(null);

    await expect(
      service.processIncome('user-1', {
        accountId: 'missing',
        amount: 100,
        description: 'Salary',
        categoryId: 'cat-1',
      })
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
  });

  it('throws ForbiddenError when user has no access to the account', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValue({
      id: 'acc-1',
      available_balance: 0,
      locked_balance: 0,
      total_balance: 0,
      emergency_reserve: 0,
    });
    accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: false });

    await expect(
      service.processIncome('user-2', {
        accountId: 'acc-1',
        amount: 100,
        description: 'Salary',
        categoryId: 'cat-1',
      })
    ).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
  });

  it('processes income using emergency reserve rules and invalidates caches', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValue({
      id: 'acc-1',
      available_balance: 100,
      locked_balance: 0,
      total_balance: 100,
      emergency_reserve: 0,
    });
    txMock.financialRule.findMany.mockResolvedValue([
      { rule_type: 'emergency_reserve', percentage: 40 },
    ]);
    txMock.account.update.mockResolvedValue({
      total_balance: 200,
      available_balance: 160,
      locked_balance: 0,
      emergency_reserve: 40,
    });
    txMock.transaction.create.mockResolvedValue({ id: 'txn-1', amount: 100 });
    txMock.balanceHistory.create.mockResolvedValue({ id: 'hist-1' });

    const result = await service.processIncome('user-1', {
      accountId: 'acc-1',
      amount: 100,
      description: 'Salary',
      categoryId: 'cat-1',
    });

    expect(result.breakdown.emergency_reserve).toBe(40);
    expect(result.breakdown.available).toBe(60);
    expect(suggestionEngineMock.invalidateCache).toHaveBeenCalledWith('acc-1');
    expect(redisMock.scanStream).toHaveBeenCalled();
    expect(redisMock.pipeline).toHaveBeenCalled();
  });

  it('returns cached list results when present', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    const cached = {
      transactions: [{ id: 'txn-1' }],
      pagination: {
        current_page: 1,
        total_pages: 1,
        total_items: 1,
        items_per_page: 50,
      },
    };

    redisMock.get.mockResolvedValueOnce(JSON.stringify(cached));

    const result = await service.list('user-1', {
      accountId: 'acc-1',
      page: 1,
      limit: 50,
    });

    expect(result.transactions).toHaveLength(1);
    expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
  });

  it('throws when listing by account and the account does not exist', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    redisMock.get.mockResolvedValueOnce(null);
    prismaMock.account.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.list('user-1', {
        accountId: 'missing',
      })
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
  });

  it('applies access checks and account filters when no accountId is provided', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    redisMock.get.mockResolvedValue(null);

    prismaMock.account.findMany.mockResolvedValue([{ id: 'acc-1' }, { id: 'acc-2' }]);
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.count.mockResolvedValue(0);

    await service.list('user-1', {
      statuses: ['paid', 'pending', 'overdue', 'locked'],
      page: 1,
      limit: 10,
    });

    expect(prismaMock.account.findMany).toHaveBeenCalled();
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          account_id: { in: ['acc-1', 'acc-2'] },
          OR: expect.any(Array),
        }),
        skip: 0,
        take: 10,
      })
    );
  });

  it('throws NotFoundError when transaction is missing on getById', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce(null);

    await expect(service.getById('user-1', 'missing')).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
  });

  it('validates duplication requires a category', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-2',
      account_id: 'acc-1',
      category_id: null,
      type: 'income',
      amount: 100,
      description: 'No category',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    await expect(service.duplicate('user-1', 'txn-2')).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
  });

  it('validates fixed expense type before marking as paid', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-3',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'income',
      amount: 100,
      description: 'Not fixed expense',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    await expect(service.markFixedExpenseAsPaid('user-1', 'txn-3')).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
  });

  it('validates fixed expense due date is not in the past', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    const past = new Date();
    past.setDate(past.getDate() - 1);
    past.setHours(0, 0, 0, 0);

    await expect(
      service.createFixedExpense('user-1', {
        accountId: 'acc-1',
        amount: 100,
        description: 'Rent',
        categoryId: 'cat-1',
        dueDate: past,
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('throws InsufficientBalanceError when fixed expense exceeds available balance', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 50,
      locked_balance: 0,
      total_balance: 100,
      emergency_reserve: 0,
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    await expect(
      service.createFixedExpense('user-1', {
        accountId: 'acc-1',
        amount: 100,
        description: 'Rent',
        categoryId: 'cat-1',
        dueDate,
      })
    ).rejects.toMatchObject({
      name: 'InsufficientBalanceError',
      statusCode: 400,
    });
  });

  it('locks balance and invalidates caches on fixed expense creation', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 200,
      locked_balance: 0,
      total_balance: 200,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 200,
      available_balance: 100,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-fixed-1' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-fixed-1' });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const result = await service.createFixedExpense('user-1', {
      accountId: 'acc-1',
      amount: 100,
      description: 'Rent',
      categoryId: 'cat-1',
      dueDate,
    });

    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          available_balance: { decrement: 100 },
          locked_balance: { increment: 100 },
        }),
      })
    );
    expect(result.transaction).toMatchObject({ id: 'txn-fixed-1' });
    expect(suggestionEngineMock.invalidateCache).toHaveBeenCalledWith('acc-1');
  });

  it('throws InsufficientBalanceError for variable expense with low balance', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 10,
      locked_balance: 0,
      total_balance: 10,
      emergency_reserve: 0,
    });

    await expect(
      service.createVariableExpense('user-1', {
        accountId: 'acc-1',
        amount: 50,
        description: 'Groceries',
        categoryId: 'cat-1',
      })
    ).rejects.toMatchObject({
      name: 'InsufficientBalanceError',
      statusCode: 400,
    });
  });

  it('debites immediately and invalidates caches on variable expense creation', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 200,
      locked_balance: 0,
      total_balance: 200,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 150,
      available_balance: 150,
      locked_balance: 0,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-var-1' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-var-1' });

    const result = await service.createVariableExpense('user-1', {
      accountId: 'acc-1',
      amount: 50,
      description: 'Groceries',
      categoryId: 'cat-1',
    });

    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total_balance: { decrement: 50 },
          available_balance: { decrement: 50 },
        }),
      })
    );
    expect(result.transaction).toMatchObject({ id: 'txn-var-1' });
    expect(suggestionEngineMock.invalidateCache).toHaveBeenCalledWith('acc-1');
  });

  it('denies listing by account when access is missing', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    redisMock.get.mockResolvedValueOnce(null);
    prismaMock.account.findUnique.mockResolvedValueOnce({ id: 'acc-1' });
    accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: false });

    await expect(
      service.list('user-2', {
        accountId: 'acc-1',
      })
    ).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
  });

  it('writes list results to cache when querying by account', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    redisMock.get.mockResolvedValueOnce(null);
    prismaMock.account.findUnique.mockResolvedValueOnce({ id: 'acc-1' });
    prismaMock.transaction.findMany.mockResolvedValueOnce([{ id: 'txn-1' }]);
    prismaMock.transaction.count.mockResolvedValueOnce(1);

    const result = await service.list('user-1', {
      accountId: 'acc-1',
      statuses: ['paid'],
      page: 1,
      limit: 20,
    });

    expect(result.transactions).toHaveLength(1);
    expect(redisMock.set).toHaveBeenCalledWith(
      expect.stringContaining('calendar:acc-1:'),
      expect.any(String),
      'EX',
      300
    );
  });

  it('adjusts locked balances when updating a locked transaction amount', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-locked-1',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'fixed_expense',
      amount: 100,
      description: 'Rent',
      status: 'locked',
      is_recurring: false,
      recurrence_pattern: null,
    });
    txMock.account.update.mockResolvedValueOnce({});
    txMock.transaction.update.mockResolvedValueOnce({
      id: 'txn-locked-1',
      amount: 150,
    });

    const result = await service.update('user-1', 'txn-locked-1', { amount: 150 });

    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          available_balance: { decrement: 50 },
          locked_balance: { increment: 50 },
        },
      })
    );
    expect(suggestionEngineMock.invalidateCache).toHaveBeenCalledWith('acc-1');
    expect(result.message).toBe('Transaction updated successfully');
  });

  it('routes duplication to the appropriate creation method', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-var-dup',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'variable_expense',
      amount: 42,
      description: 'Coffee',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    const createVariableSpy = vi
      .spyOn(service, 'createVariableExpense')
      .mockResolvedValueOnce({ transaction: { id: 'new-var' } } as never);

    const result = await service.duplicate('user-1', 'txn-var-dup');

    expect(createVariableSpy).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        amount: 42,
      })
    );
    expect(result).toMatchObject({ transaction: { id: 'new-var' } });
  });

  it('fails markFixedExpenseAsPaid when account snapshot lookup returns null', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-fixed-locked',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'fixed_expense',
      amount: 80,
      description: 'Rent',
      status: 'locked',
      is_recurring: false,
      recurrence_pattern: null,
    });

    txMock.account.update.mockResolvedValueOnce({});
    txMock.transaction.update.mockResolvedValueOnce({ id: 'txn-fixed-locked' });
    txMock.account.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.markFixedExpenseAsPaid('user-1', 'txn-fixed-locked')
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
  });

  it('reverts balances when deleting an executed income transaction', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-income-del',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'income',
      amount: 100,
      description: 'Salary',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    txMock.account.update.mockResolvedValueOnce({});
    txMock.transaction.delete.mockResolvedValueOnce({});

    const result = await service.delete('user-1', 'txn-income-del');

    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total_balance: { decrement: 100 },
          emergency_reserve: { decrement: 30 },
          available_balance: { decrement: 70 },
        }),
      })
    );
    expect(result).toEqual({ message: 'Transaction deleted successfully' });
  });
});
