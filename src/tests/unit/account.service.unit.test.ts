import { beforeEach, describe, expect, it, vi } from 'vitest';

type PrismaAccountMock = {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type PrismaMock = {
  $transaction: ReturnType<typeof vi.fn>;
  account: PrismaAccountMock;
  financialRule: { create: ReturnType<typeof vi.fn> };
  accountMember: { create: ReturnType<typeof vi.fn> };
  transaction: { count: ReturnType<typeof vi.fn> };
};

let prismaMock: PrismaMock;
let txMock: PrismaMock;
let accessMock: {
  checkAccess: ReturnType<typeof vi.fn>;
  checkOwnerPermission: ReturnType<typeof vi.fn>;
};

async function loadService() {
  vi.resetModules();

  txMock = {
    $transaction: vi.fn(),
    account: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    financialRule: { create: vi.fn() },
    accountMember: { create: vi.fn() },
    transaction: { count: vi.fn() },
  };

  prismaMock = {
    $transaction: vi.fn(async (fn: (tx: PrismaMock) => unknown) => fn(txMock)),
    account: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    financialRule: { create: vi.fn() },
    accountMember: { create: vi.fn() },
    transaction: { count: vi.fn() },
  };

  accessMock = {
    checkAccess: vi.fn().mockResolvedValue({ hasAccess: true, role: 'owner' }),
    checkOwnerPermission: vi.fn().mockResolvedValue(undefined),
  };

  class AccountMemberServiceMock {
    checkAccess = accessMock.checkAccess;
    checkOwnerPermission = accessMock.checkOwnerPermission;
  }

  vi.doMock('../../lib/prisma', () => ({
    default: prismaMock,
  }));

  vi.doMock('../../services/AccountMemberService', () => ({
    AccountMemberService: AccountMemberServiceMock,
  }));

  const module = await import('../../services/AccountService');
  return module.AccountService;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountService (unit)', () => {
  it('maps shared vs owner roles in listByUser', async () => {
    const AccountService = await loadService();
    const service = new AccountService();

    prismaMock.account.findMany.mockResolvedValueOnce([
      {
        id: 'acc-1',
        user_id: 'user-1',
        account_name: 'Primary',
        account_type: 'checking',
        total_balance: 100,
        available_balance: 80,
        locked_balance: 20,
        emergency_reserve: 30,
        currency: 'BRL',
        is_default: true,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-02'),
        members: [
          { user_id: 'user-1', role: 'owner' },
          { user_id: 'user-2', role: 'member' },
        ],
      },
      {
        id: 'acc-2',
        user_id: 'user-2',
        account_name: 'Shared',
        account_type: 'checking',
        total_balance: 50,
        available_balance: 50,
        locked_balance: 0,
        emergency_reserve: 0,
        currency: 'BRL',
        is_default: false,
        created_at: new Date('2026-01-03'),
        updated_at: new Date('2026-01-03'),
        members: [{ user_id: 'user-1', role: 'member' }],
      },
    ]);

    const result = await service.listByUser('user-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'acc-1',
      user_role: 'owner',
      is_shared: true,
    });
    expect(result[1]).toMatchObject({
      id: 'acc-2',
      user_role: 'member',
      is_shared: true,
    });
  });

  it('throws NotFoundError when getById cannot find the account', async () => {
    const AccountService = await loadService();
    const service = new AccountService();

    prismaMock.account.findUnique.mockResolvedValueOnce(null);

    await expect(service.getById('missing', 'user-1')).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
  });

  it('throws ForbiddenError when getById denies access', async () => {
    const AccountService = await loadService();
    const service = new AccountService();

    prismaMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      user_id: 'user-2',
      financial_rules: [],
    });
    accessMock.checkAccess.mockResolvedValueOnce({ hasAccess: false });

    await expect(service.getById('acc-1', 'user-1')).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
  });

  it('validates account name and handles default flag on create', async () => {
    const AccountService = await loadService();
    const service = new AccountService();

    await expect(
      service.create('user-1', { account_name: '   ', is_default: false })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });

    txMock.account.create.mockResolvedValueOnce({
      id: 'acc-1',
      user_id: 'user-1',
      account_name: 'Primary',
      account_type: 'checking',
      is_default: true,
    });

    const created = await service.create('user-1', {
      account_name: 'Primary',
      is_default: true,
    });

    expect(prismaMock.account.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1', is_default: true },
      })
    );
    expect(txMock.financialRule.create).toHaveBeenCalled();
    expect(txMock.accountMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'owner' }),
      })
    );
    expect(created).toMatchObject({ id: 'acc-1' });
  });

  it('updates account and clears other defaults when needed', async () => {
    const AccountService = await loadService();
    const service = new AccountService();

    prismaMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      user_id: 'user-1',
      financial_rules: [],
    });

    prismaMock.account.update.mockResolvedValueOnce({
      id: 'acc-1',
      account_name: 'Updated',
      is_default: true,
    });

    const updated = await service.update('acc-1', 'user-1', {
      account_name: 'Updated',
      is_default: true,
    });

    expect(accessMock.checkOwnerPermission).toHaveBeenCalledWith('acc-1', 'user-1');
    expect(prismaMock.account.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1', is_default: true, id: { not: 'acc-1' } },
      })
    );
    expect(updated).toMatchObject({ id: 'acc-1', account_name: 'Updated' });
  });

  it('prevents delete when there are transactions or non-zero balance', async () => {
    const AccountService = await loadService();
    const service = new AccountService();

    prismaMock.account.findUnique.mockResolvedValue({
      id: 'acc-1',
      user_id: 'user-1',
      total_balance: 0,
      financial_rules: [],
    });

    prismaMock.transaction.count.mockResolvedValueOnce(2);

    await expect(service.delete('acc-1', 'user-1')).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });

    prismaMock.transaction.count.mockResolvedValueOnce(0);
    prismaMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      user_id: 'user-1',
      total_balance: 10,
      financial_rules: [],
    });

    await expect(service.delete('acc-1', 'user-1')).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
  });

  it('deletes the account when it is empty and has zero balance', async () => {
    const AccountService = await loadService();
    const service = new AccountService();

    prismaMock.account.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      user_id: 'user-1',
      total_balance: 0,
      financial_rules: [],
    });
    prismaMock.transaction.count.mockResolvedValueOnce(0);

    const result = await service.delete('acc-1', 'user-1');

    expect(prismaMock.account.delete).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
    });
    expect(result).toEqual({ message: 'Account deleted successfully' });
  });

  it('falls back to first account or throws on getDefaultAccount', async () => {
    const AccountService = await loadService();
    const service = new AccountService();

    prismaMock.account.findFirst.mockResolvedValueOnce(null);
    prismaMock.account.findFirst.mockResolvedValueOnce({
      id: 'acc-1',
      user_id: 'user-1',
      is_default: false,
    });

    const fallback = await service.getDefaultAccount('user-1');
    expect(fallback).toMatchObject({ id: 'acc-1' });

    prismaMock.account.findFirst.mockResolvedValueOnce(null);
    prismaMock.account.findFirst.mockResolvedValueOnce(null);

    await expect(service.getDefaultAccount('user-1')).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
  });

  it('validates emergency reserve and uses provided client when available', async () => {
    const AccountService = await loadService();
    const service = new AccountService();

    const client = {
      account: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
          id: 'acc-1',
          currency: 'BRL',
          emergency_reserve: 0,
        }),
      },
    };

    await expect(
      service.getDefaultEmergencyReserve('user-1', client as never)
    ).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });

    const happyClient = {
      account: {
        findFirst: vi.fn().mockResolvedValueOnce({
          id: 'acc-2',
          currency: 'BRL',
          emergency_reserve: 300,
        }),
      },
    };

    const reserve = await service.getDefaultEmergencyReserve('user-1', happyClient as never);
    expect(happyClient.account.findFirst).toHaveBeenCalled();
    expect(reserve).toEqual({
      accountId: 'acc-2',
      currency: 'BRL',
      emergencyReserveAmount: 300,
    });
  });
});
