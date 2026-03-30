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
  createMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type PrismaMock = {
  $transaction: ReturnType<typeof vi.fn>;
  account: PrismaAccountMock;
  financialRule: { findMany: ReturnType<typeof vi.fn> };
  category: { findFirst: ReturnType<typeof vi.fn> };
  transaction: PrismaTransactionMock;
  balanceHistory: { create: ReturnType<typeof vi.fn> };
  notification: { create: ReturnType<typeof vi.fn> };
  auditEvent: { create: ReturnType<typeof vi.fn> };
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
    category: { findFirst: vi.fn() },
    transaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMany: vi.fn(),
    },
    balanceHistory: { create: vi.fn() },
    notification: { create: vi.fn() },
    auditEvent: { create: vi.fn() },
  };

  prismaMock = {
    $transaction: vi.fn(async (fn: (tx: PrismaMock) => unknown) => fn(txMock)),
    account: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    financialRule: { findMany: vi.fn() },
    category: { findFirst: vi.fn() },
    transaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMany: vi.fn(),
    },
    balanceHistory: { create: vi.fn() },
    notification: { create: vi.fn() },
    auditEvent: { create: vi.fn() },
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

    expect(result.breakdown!.emergency_reserve).toBe(40);
    expect(result.breakdown!.available).toBe(60);
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

  it('allows fixed expense with past due date (overdue debt registration)', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    const past = new Date();
    past.setDate(past.getDate() - 1);
    past.setHours(0, 0, 0, 0);

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 500,
      locked_balance: 0,
      total_balance: 500,
      emergency_reserve: 0,
    });
    accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: true });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 500,
      available_balance: 400,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-past', amount: 100 });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-1' });

    // Deve criar sem erro — dívidas do passado são válidas
    await expect(
      service.createFixedExpense('user-1', {
        type: 'fixed',
        accountId: 'acc-1',
        amount: 100,
        description: 'Overdue rent',
        categoryId: 'cat-1',
        dueDate: past,
      })
    ).resolves.toBeDefined();
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
        type: 'fixed',
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
      type: 'fixed',
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
        type: 'variable',
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
      type: 'variable',
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
    expect(result.message).toBe('Transação atualizada com sucesso');
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
    expect(result).toEqual({ message: 'Transação excluída com sucesso' });
  });

  it('reverts locked balance when deleting a locked fixed expense transaction', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-locked-del',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'fixed_expense',
      amount: 200,
      description: 'Rent',
      status: 'locked',
      is_recurring: false,
      recurrence_pattern: null,
    });

    txMock.account.update.mockResolvedValueOnce({});
    txMock.transaction.delete.mockResolvedValueOnce({});

    const result = await service.delete('user-1', 'txn-locked-del');

    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          available_balance: { increment: 200 },
          locked_balance: { decrement: 200 },
        }),
      })
    );
    expect(result).toEqual({ message: 'Transação excluída com sucesso' });
  });

  it('reverts balances when deleting an executed variable expense transaction', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-var-del',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'variable_expense',
      amount: 150,
      description: 'Groceries',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    txMock.account.update.mockResolvedValueOnce({});
    txMock.transaction.delete.mockResolvedValueOnce({});

    const result = await service.delete('user-1', 'txn-var-del');

    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total_balance: { increment: 150 },
          available_balance: { increment: 150 },
        }),
      })
    );
    expect(result).toEqual({ message: 'Transação excluída com sucesso' });
  });

  it('throws ForbiddenError when deleting a transaction without access', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-no-access',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'income',
      amount: 100,
      description: 'Salary',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: false });

    await expect(service.delete('user-2', 'txn-no-access')).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
  });

  it('updates transaction without changing amount when only description is provided', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-update-desc',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'income',
      amount: 100,
      description: 'Old description',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    txMock.transaction.update.mockResolvedValueOnce({
      id: 'txn-update-desc',
      amount: 100,
      description: 'New description',
    });

    const result = await service.update('user-1', 'txn-update-desc', {
      description: 'New description',
    });

    expect(txMock.account.update).not.toHaveBeenCalled();
    expect(result.message).toBe('Transação atualizada com sucesso');
    expect(suggestionEngineMock.invalidateCache).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when updating a transaction without access', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-no-access-update',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'income',
      amount: 100,
      description: 'Salary',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: false });

    await expect(
      service.update('user-2', 'txn-no-access-update', { amount: 150 })
    ).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
  });

  it('throws ForbiddenError when marking fixed expense as paid without access', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-no-access-paid',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'fixed_expense',
      amount: 100,
      description: 'Rent',
      status: 'locked',
      is_recurring: false,
      recurrence_pattern: null,
    });

    accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: false });

    await expect(
      service.markFixedExpenseAsPaid('user-2', 'txn-no-access-paid')
    ).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
  });

  it('throws ValidationError when marking a non-locked transaction as paid', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-not-locked',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'fixed_expense',
      amount: 100,
      description: 'Rent',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    await expect(service.markFixedExpenseAsPaid('user-1', 'txn-not-locked')).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
  });

  it('throws ForbiddenError when duplicating a transaction without access', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-no-access-dup',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'income',
      amount: 100,
      description: 'Salary',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: false });

    await expect(service.duplicate('user-2', 'txn-no-access-dup')).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
  });

  it('duplicates an income transaction successfully', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-income-dup',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'income',
      amount: 100,
      description: 'Salary',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    const processIncomeSpy = vi
      .spyOn(service, 'processIncome')
      .mockResolvedValueOnce({ transaction: { id: 'new-income' } } as never);

    const result = await service.duplicate('user-1', 'txn-income-dup');

    expect(processIncomeSpy).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        amount: 100,
        description: 'Salary (cópia)',
      })
    );
    expect(result).toMatchObject({ transaction: { id: 'new-income' } });
  });

  it('duplicates a fixed expense transaction successfully', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-fixed-dup',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'fixed_expense',
      amount: 200,
      description: 'Rent',
      status: 'locked',
      is_recurring: false,
      recurrence_pattern: 'monthly',
      due_date: new Date('2026-02-01'),
    });

    const createFixedExpenseSpy = vi
      .spyOn(service, 'createFixedExpense')
      .mockResolvedValueOnce({ transaction: { id: 'new-fixed' } } as never);

    const result = await service.duplicate('user-1', 'txn-fixed-dup');

    expect(createFixedExpenseSpy).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        amount: 200,
        type: 'fixed',
        description: 'Rent (cópia)',
      })
    );
    expect(result).toMatchObject({ transaction: { id: 'new-fixed' } });
  });

  it('throws when duplicating a transaction with invalid type', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-invalid-type',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'unknown_type',
      amount: 100,
      description: 'Unknown',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    await expect(service.duplicate('user-1', 'txn-invalid-type')).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
  });

  it('generates recurring installments for indefinite expense', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 500,
      locked_balance: 0,
      total_balance: 500,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 500,
      available_balance: 400,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-recurring' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-recurring' });
    txMock.transaction.createMany.mockResolvedValueOnce({ count: 12 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    await service.createFixedExpense('user-1', {
      type: 'fixed',
      accountId: 'acc-1',
      amount: 100,
      description: 'Monthly Rent',
      categoryId: 'cat-1',
      dueDate,
      isRecurring: true,
      recurrencePattern: 'monthly',
      indefinite: true,
    });

    expect(txMock.transaction.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            status: 'pending',
            is_recurring: true,
          }),
        ]),
      })
    );
  });

  it('generates recurring installments with recurrence count', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 500,
      locked_balance: 0,
      total_balance: 500,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 500,
      available_balance: 400,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-recurring-count' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-recurring-count' });
    txMock.transaction.createMany.mockResolvedValueOnce({ count: 2 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    await service.createFixedExpense('user-1', {
      type: 'fixed',
      accountId: 'acc-1',
      amount: 100,
      description: 'Quarterly Rent',
      categoryId: 'cat-1',
      dueDate,
      isRecurring: true,
      recurrencePattern: 'monthly',
      recurrenceCount: 3,
    });

    expect(txMock.transaction.createMany).toHaveBeenCalled();
  });

  it('generates recurring installments with end date', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 500,
      locked_balance: 0,
      total_balance: 500,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 500,
      available_balance: 400,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-recurring-end' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-recurring-end' });
    txMock.transaction.createMany.mockResolvedValueOnce({ count: 5 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const endDate = new Date(dueDate);
    endDate.setMonth(endDate.getMonth() + 5);

    await service.createFixedExpense('user-1', {
      type: 'fixed',
      accountId: 'acc-1',
      amount: 100,
      description: 'Temporary Rent',
      categoryId: 'cat-1',
      dueDate,
      isRecurring: true,
      recurrencePattern: 'monthly',
      recurrenceEndDate: endDate,
    });

    expect(txMock.transaction.createMany).toHaveBeenCalled();
  });

  it('generates recurring installments with weekly pattern', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 500,
      locked_balance: 0,
      total_balance: 500,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 500,
      available_balance: 400,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-weekly' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-weekly' });
    txMock.transaction.createMany.mockResolvedValueOnce({ count: 12 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    await service.createFixedExpense('user-1', {
      type: 'fixed',
      accountId: 'acc-1',
      amount: 50,
      description: 'Weekly Expense',
      categoryId: 'cat-1',
      dueDate,
      isRecurring: true,
      recurrencePattern: 'weekly',
      indefinite: true,
    });

    expect(txMock.transaction.createMany).toHaveBeenCalled();
  });

  it('generates recurring installments with yearly pattern', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 5000,
      locked_balance: 0,
      total_balance: 5000,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 5000,
      available_balance: 4900,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-yearly' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-yearly' });
    txMock.transaction.createMany.mockResolvedValueOnce({ count: 12 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    await service.createFixedExpense('user-1', {
      type: 'fixed',
      accountId: 'acc-1',
      amount: 100,
      description: 'Yearly Expense',
      categoryId: 'cat-1',
      dueDate,
      isRecurring: true,
      recurrencePattern: 'yearly',
      indefinite: true,
    });

    expect(txMock.transaction.createMany).toHaveBeenCalled();
  });

  it('generates recurring installments with custom interval', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 500,
      locked_balance: 0,
      total_balance: 500,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 500,
      available_balance: 400,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-interval' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-interval' });
    txMock.transaction.createMany.mockResolvedValueOnce({ count: 4 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    await service.createFixedExpense('user-1', {
      type: 'fixed',
      accountId: 'acc-1',
      amount: 100,
      description: 'Quarterly Expense',
      categoryId: 'cat-1',
      dueDate,
      isRecurring: true,
      recurrencePattern: 'monthly',
      recurrenceInterval: 3,
      indefinite: true,
    });

    expect(txMock.transaction.createMany).toHaveBeenCalled();
  });

  it('does not generate installments when end date is before due date', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 500,
      locked_balance: 0,
      total_balance: 500,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 500,
      available_balance: 400,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-invalid-range' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-invalid-range' });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const endDate = new Date(dueDate);
    endDate.setDate(endDate.getDate() - 1);

    await service.createFixedExpense('user-1', {
      type: 'fixed',
      accountId: 'acc-1',
      amount: 100,
      description: 'Invalid Range',
      categoryId: 'cat-1',
      dueDate,
      isRecurring: true,
      recurrencePattern: 'monthly',
      recurrenceEndDate: endDate,
    });

    expect(txMock.transaction.createMany).not.toHaveBeenCalled();
  });

  it('throws ValidationError when fixed expense has multiple recurrence end types', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const endDate = new Date(dueDate);
    endDate.setMonth(endDate.getMonth() + 6);

    await expect(
      service.createFixedExpense('user-1', {
        type: 'fixed',
        accountId: 'acc-1',
        amount: 100,
        description: 'Multiple end types',
        categoryId: 'cat-1',
        dueDate,
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceCount: 5,
        recurrenceEndDate: endDate,
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
  });

  it('defaults to indefinite when isRecurring is true but no end type is specified', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 500,
      locked_balance: 0,
      total_balance: 500,
      emergency_reserve: 0,
    });
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 500,
      available_balance: 400,
      locked_balance: 100,
      emergency_reserve: 0,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-default-indefinite' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-default-indefinite' });
    txMock.transaction.createMany.mockResolvedValueOnce({ count: 12 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    await service.createFixedExpense('user-1', {
      type: 'fixed',
      accountId: 'acc-1',
      amount: 100,
      description: 'Default indefinite',
      categoryId: 'cat-1',
      dueDate,
      isRecurring: true,
      recurrencePattern: 'monthly',
    });

    expect(txMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          indefinite: true,
        }),
      })
    );
  });

  it('adjusts available and locked balances when updating a locked transaction with decreased amount', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-locked-decrease',
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
      id: 'txn-locked-decrease',
      amount: 50,
    });

    await service.update('user-1', 'txn-locked-decrease', { amount: 50 });

    // amountDiff = 50 - 100 = -50
    // decrement: -50 === increment 50
    // increment: -50 === decrement 50
    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          available_balance: { decrement: -50 },
          locked_balance: { increment: -50 },
        }),
      })
    );
  });

  it('adjusts balances correctly when updating an executed income transaction', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-income-update',
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
    txMock.transaction.update.mockResolvedValueOnce({
      id: 'txn-income-update',
      amount: 200,
    });

    await service.update('user-1', 'txn-income-update', { amount: 200 });

    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total_balance: { increment: 100 },
          emergency_reserve: { increment: 30 },
          available_balance: { increment: 70 },
        }),
      })
    );
  });

  it('adjusts balances correctly when updating an executed variable expense transaction', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-var-update',
      account_id: 'acc-1',
      category_id: 'cat-1',
      type: 'variable_expense',
      amount: 100,
      description: 'Groceries',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });
    txMock.account.update.mockResolvedValueOnce({});
    txMock.transaction.update.mockResolvedValueOnce({
      id: 'txn-var-update',
      amount: 150,
    });

    await service.update('user-1', 'txn-var-update', { amount: 150 });

    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total_balance: { decrement: 50 },
          available_balance: { decrement: 50 },
        }),
      })
    );
  });

  it('marks fixed expense as paid and updates balances correctly', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-mark-paid',
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
      id: 'txn-mark-paid',
      status: 'executed',
    });
    txMock.account.findUnique.mockResolvedValueOnce({
      total_balance: 400,
      available_balance: 400,
      locked_balance: 0,
      emergency_reserve: 0,
    });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-mark-paid' });

    const result = await service.markFixedExpenseAsPaid('user-1', 'txn-mark-paid');

    expect(txMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total_balance: { decrement: 100 },
          locked_balance: { decrement: 100 },
        }),
      })
    );
    expect(result.message).toBe('Despesa fixa marcada como paga com sucesso');
    expect(suggestionEngineMock.invalidateCache).toHaveBeenCalledWith('acc-1');
  });

  it('throws NotFoundError when marking fixed expense as paid and account is not found', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-no-account',
      account_id: 'acc-missing',
      category_id: 'cat-1',
      type: 'fixed_expense',
      amount: 100,
      description: 'Rent',
      status: 'locked',
      is_recurring: false,
      recurrence_pattern: null,
    });

    txMock.account.update.mockResolvedValueOnce({});
    txMock.transaction.update.mockResolvedValueOnce({ id: 'txn-no-account' });
    txMock.account.findUnique.mockResolvedValueOnce(null);

    await expect(service.markFixedExpenseAsPaid('user-1', 'txn-no-account')).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
  });

  it('throws NotFoundError when accessing a transaction from a non-existent account', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    prismaMock.transaction.findUnique.mockResolvedValueOnce({
      id: 'txn-missing-account',
      account_id: 'acc-missing',
      category_id: 'cat-1',
      type: 'income',
      amount: 100,
      description: 'Salary',
      status: 'executed',
      is_recurring: false,
      recurrence_pattern: null,
    });

    prismaMock.account.findUnique.mockResolvedValueOnce(null);
    accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: false });

    await expect(service.getById('user-1', 'txn-missing-account')).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
  });

  describe('transfer', () => {
    it('throws ValidationError when amount is not positive', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      await expect(
        service.transfer('user-1', {
          sourceAccountId: 'acc-1',
          destinationAccountId: 'acc-2',
          amount: 0,
        })
      ).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws ValidationError when source and destination accounts are the same', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      await expect(
        service.transfer('user-1', {
          sourceAccountId: 'acc-1',
          destinationAccountId: 'acc-1',
          amount: 100,
        })
      ).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when source account does not exist', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      prismaMock.$transaction.mockImplementation(async (fn) => {
        txMock.account.findUnique.mockResolvedValueOnce(null);
        return fn(txMock);
      });

      await expect(
        service.transfer('user-1', {
          sourceAccountId: 'missing',
          destinationAccountId: 'acc-2',
          amount: 100,
        })
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });

    it('throws ForbiddenError when user is not owner of source account', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: true, role: 'member' });

      prismaMock.$transaction.mockImplementation(async (fn) => {
        txMock.account.findUnique.mockResolvedValueOnce({
          id: 'acc-1',
          user_id: 'other-user',
          account_name: 'Source Account',
          available_balance: 500,
          locked_balance: 0,
          total_balance: 500,
          emergency_reserve: 0,
        });
        return fn(txMock);
      });

      await expect(
        service.transfer('user-1', {
          sourceAccountId: 'acc-1',
          destinationAccountId: 'acc-2',
          amount: 100,
        })
      ).rejects.toMatchObject({
        name: 'ForbiddenError',
        statusCode: 403,
      });
    });

    it('throws InsufficientBalanceError when source account has insufficient balance', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      prismaMock.$transaction.mockImplementation(async (fn) => {
        txMock.account.findUnique.mockResolvedValueOnce({
          id: 'acc-1',
          user_id: 'user-1',
          account_name: 'Source Account',
          available_balance: 50,
          locked_balance: 0,
          total_balance: 50,
          emergency_reserve: 0,
        });
        return fn(txMock);
      });

      await expect(
        service.transfer('user-1', {
          sourceAccountId: 'acc-1',
          destinationAccountId: 'acc-2',
          amount: 100,
        })
      ).rejects.toMatchObject({
        name: 'InsufficientBalanceError',
        statusCode: 400,
      });
    });

    it('throws NotFoundError when destination account does not exist', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      prismaMock.$transaction.mockImplementation(async (fn) => {
        txMock.account.findUnique
          .mockResolvedValueOnce({
            id: 'acc-1',
            user_id: 'user-1',
            account_name: 'Source Account',
            available_balance: 500,
            locked_balance: 0,
            total_balance: 500,
            emergency_reserve: 0,
          })
          .mockResolvedValueOnce(null);
        return fn(txMock);
      });

      await expect(
        service.transfer('user-1', {
          sourceAccountId: 'acc-1',
          destinationAccountId: 'missing',
          amount: 100,
        })
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });

    it('throws NotFoundError when transfer category does not exist', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      prismaMock.$transaction.mockImplementation(async (fn) => {
        txMock.account.findUnique
          .mockResolvedValueOnce({
            id: 'acc-1',
            user_id: 'user-1',
            account_name: 'Source Account',
            available_balance: 500,
            locked_balance: 0,
            total_balance: 500,
            emergency_reserve: 0,
          })
          .mockResolvedValueOnce({
            id: 'acc-2',
            user_id: 'user-2',
            account_name: 'Destination Account',
          });
        txMock.category.findFirst.mockResolvedValueOnce(null);
        return fn(txMock);
      });

      await expect(
        service.transfer('user-1', {
          sourceAccountId: 'acc-1',
          destinationAccountId: 'acc-2',
          amount: 100,
        })
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });

    it('successfully transfers money between accounts', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      const sourceAccount = {
        id: 'acc-1',
        user_id: 'user-1',
        account_name: 'Source Account',
        available_balance: 500,
        locked_balance: 0,
        total_balance: 500,
        emergency_reserve: 0,
      };

      const destinationAccount = {
        id: 'acc-2',
        user_id: 'user-2',
        account_name: 'Destination Account',
        available_balance: 200,
        locked_balance: 0,
        total_balance: 200,
        emergency_reserve: 0,
      };

      const transferCategory = {
        id: 'cat-transfer',
        name: 'Transferências',
        type: 'transfer',
        is_system: true,
      };

      const debitTransaction = {
        id: 'txn-debit',
        account_id: 'acc-1',
        type: 'transfer',
        amount: 100,
        description: 'Payment',
        destination_account_id: 'acc-2',
        status: 'executed',
        created_at: new Date(),
      };

      const creditTransaction = {
        id: 'txn-credit',
        account_id: 'acc-2',
        type: 'transfer',
        amount: 100,
        description: 'Payment',
        source_account_id: 'acc-1',
        status: 'executed',
        created_at: new Date(),
      };

      prismaMock.$transaction.mockImplementation(async (fn) => {
        txMock.account.findUnique
          .mockResolvedValueOnce(sourceAccount)
          .mockResolvedValueOnce(destinationAccount)
          .mockResolvedValueOnce({ ...sourceAccount, available_balance: 400, total_balance: 400 })
          .mockResolvedValueOnce({
            ...destinationAccount,
            available_balance: 300,
            total_balance: 300,
          });

        txMock.category.findFirst.mockResolvedValueOnce(transferCategory);
        txMock.account.update.mockResolvedValueOnce({}).mockResolvedValueOnce({});
        txMock.transaction.create
          .mockResolvedValueOnce(debitTransaction)
          .mockResolvedValueOnce(creditTransaction);
        txMock.balanceHistory.create
          .mockResolvedValueOnce({ id: 'hist-1' })
          .mockResolvedValueOnce({ id: 'hist-2' });
        txMock.notification.create
          .mockResolvedValueOnce({ id: 'notif-1' })
          .mockResolvedValueOnce({ id: 'notif-2' });
        txMock.auditEvent.create.mockResolvedValueOnce({ id: 'audit-1' });

        return fn(txMock);
      });

      const result = await service.transfer('user-1', {
        sourceAccountId: 'acc-1',
        destinationAccountId: 'acc-2',
        amount: 100,
        description: 'Payment',
      });

      expect(result.transfer).toMatchObject({
        id: 'txn-debit',
        amount: 100,
        description: 'Payment',
        sourceAccount: { id: 'acc-1', account_name: 'Source Account' },
        destinationAccount: { id: 'acc-2', account_name: 'Destination Account' },
      });

      expect(result.debitTransaction).toMatchObject(debitTransaction);
      expect(result.creditTransaction).toMatchObject(creditTransaction);

      expect(txMock.account.update).toHaveBeenCalledTimes(2);
      expect(txMock.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: expect.objectContaining({
            total_balance: { decrement: 100 },
            available_balance: { decrement: 100 },
          }),
        })
      );
      expect(txMock.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-2' },
          data: expect.objectContaining({
            total_balance: { increment: 100 },
            available_balance: { increment: 100 },
          }),
        })
      );

      expect(txMock.transaction.create).toHaveBeenCalledTimes(2);
      expect(txMock.balanceHistory.create).toHaveBeenCalledTimes(2);
      expect(txMock.notification.create).toHaveBeenCalledTimes(2);
      expect(txMock.auditEvent.create).toHaveBeenCalledTimes(1);

      expect(redisMock.scanStream).toHaveBeenCalledTimes(2);
    });

    it('creates transfer without description when not provided', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      prismaMock.$transaction.mockImplementation(async (fn) => {
        txMock.account.findUnique
          .mockResolvedValueOnce({
            id: 'acc-1',
            user_id: 'user-1',
            account_name: 'Source',
            available_balance: 500,
            locked_balance: 0,
            total_balance: 500,
            emergency_reserve: 0,
          })
          .mockResolvedValueOnce({
            id: 'acc-2',
            user_id: 'user-2',
            account_name: 'Dest',
          })
          .mockResolvedValueOnce({ available_balance: 400, total_balance: 400 })
          .mockResolvedValueOnce({ available_balance: 100, total_balance: 100 });

        txMock.category.findFirst.mockResolvedValueOnce({ id: 'cat-transfer' });
        txMock.account.update.mockResolvedValueOnce({}).mockResolvedValueOnce({});
        txMock.transaction.create
          .mockResolvedValueOnce({ id: 'txn-debit', description: 'Transferência para conta acc-2' })
          .mockResolvedValueOnce({
            id: 'txn-credit',
            description: 'Transferência recebida de conta acc-1',
          });
        txMock.balanceHistory.create.mockResolvedValueOnce({}).mockResolvedValueOnce({});
        txMock.notification.create.mockResolvedValueOnce({}).mockResolvedValueOnce({});
        txMock.auditEvent.create.mockResolvedValueOnce({});

        return fn(txMock);
      });

      await service.transfer('user-1', {
        sourceAccountId: 'acc-1',
        destinationAccountId: 'acc-2',
        amount: 100,
      });

      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: expect.stringContaining('Transferência para conta acc-2'),
          }),
        })
      );
    });

    it('invalidates calendar cache for both accounts', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      prismaMock.$transaction.mockImplementation(async (fn) => {
        txMock.account.findUnique
          .mockResolvedValueOnce({
            id: 'acc-1',
            user_id: 'user-1',
            account_name: 'Source',
            available_balance: 500,
            locked_balance: 0,
            total_balance: 500,
            emergency_reserve: 0,
          })
          .mockResolvedValueOnce({
            id: 'acc-2',
            user_id: 'user-2',
            account_name: 'Dest',
          })
          .mockResolvedValueOnce({ available_balance: 400, total_balance: 400 })
          .mockResolvedValueOnce({ available_balance: 100, total_balance: 100 });

        txMock.category.findFirst.mockResolvedValueOnce({ id: 'cat-transfer' });
        txMock.account.update.mockResolvedValueOnce({}).mockResolvedValueOnce({});
        txMock.transaction.create
          .mockResolvedValueOnce({ id: 'txn-debit' })
          .mockResolvedValueOnce({ id: 'txn-credit' });
        txMock.balanceHistory.create.mockResolvedValueOnce({}).mockResolvedValueOnce({});
        txMock.notification.create.mockResolvedValueOnce({}).mockResolvedValueOnce({});
        txMock.auditEvent.create.mockResolvedValueOnce({});

        return fn(txMock);
      });

      await service.transfer('user-1', {
        sourceAccountId: 'acc-1',
        destinationAccountId: 'acc-2',
        amount: 100,
      });

      expect(redisMock.scanStream).toHaveBeenCalledTimes(2);
      expect(redisMock.scanStream).toHaveBeenCalledWith({
        match: 'calendar:acc-1:*',
      });
      expect(redisMock.scanStream).toHaveBeenCalledWith({
        match: 'calendar:acc-2:*',
      });
    });
  });

  // ── processIncome: receita agendada (dueDate futuro) ──────────────────────
  describe('processIncome — receita agendada', () => {
    it('deve criar receita como pending quando dueDate está no futuro', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      txMock.account.findUnique.mockResolvedValueOnce({
        id: 'acc-1',
        available_balance: 0,
        locked_balance: 0,
        total_balance: 0,
        emergency_reserve: 0,
      });
      txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-pending', status: 'pending' });

      const result = await service.processIncome('user-1', {
        accountId: 'acc-1',
        amount: 200,
        description: 'Salário futuro',
        categoryId: 'cat-1',
        dueDate: tomorrow,
      });

      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
          }),
        })
      );
      // saldo NÃO deve ser atualizado para receita agendada
      expect(txMock.account.update).not.toHaveBeenCalled();
      expect(result.transaction).toMatchObject({ id: 'txn-pending' });
    });

    it('deve gerar instâncias recorrentes quando isRecurring=true e recurrencePattern está definido (receita agendada)', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      txMock.account.findUnique.mockResolvedValueOnce({
        id: 'acc-1',
        available_balance: 0,
        locked_balance: 0,
        total_balance: 0,
        emergency_reserve: 0,
      });
      txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-pending-recurring' });
      txMock.transaction.createMany.mockResolvedValueOnce({ count: 12 });

      await service.processIncome('user-1', {
        accountId: 'acc-1',
        amount: 300,
        description: 'Salário recorrente futuro',
        categoryId: 'cat-1',
        dueDate: tomorrow,
        isRecurring: true,
        recurrencePattern: 'monthly',
        indefinite: true,
      });

      expect(txMock.transaction.createMany).toHaveBeenCalled();
      expect(txMock.account.update).not.toHaveBeenCalled();
    });
  });

  // ── processIncome: validação de múltiplos tipos de fim de recorrência ─────
  it('deve lançar ValidationError quando múltiplos tipos de fim de recorrência são especificados', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const endDate = new Date(tomorrow);
    endDate.setMonth(endDate.getMonth() + 3);

    await expect(
      service.processIncome('user-1', {
        accountId: 'acc-1',
        amount: 500,
        description: 'Receita com conflito de recorrência',
        categoryId: 'cat-1',
        dueDate: tomorrow,
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceCount: 5,
        recurrenceEndDate: endDate,
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
  });

  // ── processIncome: receita imediata recorrente ────────────────────────────
  it('deve gerar instâncias futuras quando receita imediata é recorrente', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    txMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      available_balance: 1000,
      locked_balance: 0,
      total_balance: 1000,
      emergency_reserve: 0,
    });
    txMock.financialRule.findMany.mockResolvedValue([]);
    txMock.account.update.mockResolvedValueOnce({
      total_balance: 1500,
      available_balance: 1350,
      locked_balance: 0,
      emergency_reserve: 150,
    });
    txMock.transaction.create.mockResolvedValueOnce({ id: 'txn-immediate-recurring' });
    txMock.balanceHistory.create.mockResolvedValueOnce({ id: 'hist-imm-rec' });
    txMock.transaction.createMany.mockResolvedValueOnce({ count: 12 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await service.processIncome('user-1', {
      accountId: 'acc-1',
      amount: 500,
      description: 'Salário mensal recorrente',
      categoryId: 'cat-1',
      dueDate: today,
      isRecurring: true,
      recurrencePattern: 'monthly',
      indefinite: true,
    });

    expect(txMock.transaction.createMany).toHaveBeenCalled();
    expect(txMock.account.update).toHaveBeenCalled();
  });

  // ── createFixedExpense: despesa flutuante ────────────────────────────────
  describe('createFixedExpense — despesa flutuante', () => {
    it('deve criar despesa flutuante quando isFloating=true', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      prismaMock.account.findUnique.mockResolvedValueOnce({
        id: 'acc-1',
        available_balance: 200,
        locked_balance: 0,
        total_balance: 200,
        emergency_reserve: 0,
      });
      prismaMock.transaction.create.mockResolvedValueOnce({
        id: 'txn-floating',
        is_floating: true,
        due_date: null,
        status: 'pending',
      });

      const result = await service.createFixedExpense('user-1', {
        type: 'fixed',
        accountId: 'acc-1',
        amount: 150,
        description: 'Dívida flutuante',
        categoryId: 'cat-1',
        isFloating: true,
      });

      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_floating: true,
            due_date: null,
            status: 'pending',
          }),
        })
      );
      // Não deve usar o prisma.$transaction (bloquear saldo)
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(result.transaction).toMatchObject({ id: 'txn-floating' });
    });

    it('deve lançar ValidationError quando amount <= 0 para despesa fixa', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      await expect(
        service.createFixedExpense('user-1', {
          type: 'fixed',
          accountId: 'acc-1',
          amount: -1,
          description: 'Valor inválido',
          categoryId: 'cat-1',
          dueDate: new Date(),
        })
      ).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
    });

    it('deve lançar ValidationError quando dueDate não é informado para despesa fixa não flutuante', async () => {
      const TransactionService = await loadService();
      const service = new TransactionService();

      await expect(
        service.createFixedExpense('user-1', {
          type: 'fixed',
          accountId: 'acc-1',
          amount: 100,
          description: 'Sem dueDate',
          categoryId: 'cat-1',
        })
      ).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
    });
  });

  // ── createVariableExpense: validação de amount ────────────────────────────
  it('deve lançar ValidationError quando amount <= 0 para despesa variável', async () => {
    const TransactionService = await loadService();
    const service = new TransactionService();

    await expect(
      service.createVariableExpense('user-1', {
        type: 'variable',
        accountId: 'acc-1',
        amount: 0,
        description: 'Valor inválido',
        categoryId: 'cat-1',
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
