import { beforeEach, describe, expect, it, vi } from 'vitest';
type PrismaMock = {
  account: { findUnique: ReturnType<typeof vi.fn> };
  accountMember: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  accountInvitation: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

let prismaMock: PrismaMock;

async function loadService() {
  vi.resetModules();

  prismaMock = {
    account: { findUnique: vi.fn() },
    accountMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    accountInvitation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: PrismaMock) => unknown) => fn(prismaMock)),
  };

  vi.doMock('../../lib/prisma', () => ({
    default: prismaMock,
  }));

  const module = await import('../../services/AccountMemberService');
  return module.AccountMemberService;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountMemberService (unit)', () => {
  it('grants access to the account owner', async () => {
    const AccountMemberService = await loadService();
    const service = new AccountMemberService();

    prismaMock.account.findUnique.mockResolvedValue({ id: 'acc-1', user_id: 'user-1' });

    const access = await service.checkAccess('acc-1', 'user-1');

    expect(access).toEqual({ hasAccess: true, role: 'owner' });
    expect(prismaMock.accountMember.findUnique).not.toHaveBeenCalled();
  });

  it('grants access to a member when not the owner', async () => {
    const AccountMemberService = await loadService();
    const service = new AccountMemberService();

    prismaMock.account.findUnique.mockResolvedValue({ id: 'acc-2', user_id: 'owner-1' });
    prismaMock.accountMember.findUnique.mockResolvedValue({ role: 'member' });

    const access = await service.checkAccess('acc-2', 'user-2');

    expect(access).toEqual({ hasAccess: true, role: 'member' });
  });

  it('throws NotFoundError when checking owner permission for missing account', async () => {
    const AccountMemberService = await loadService();
    const service = new AccountMemberService();

    prismaMock.account.findUnique.mockResolvedValue(null);

    await expect(service.checkOwnerPermission('missing', 'user-1')).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
  });

  it('throws ForbiddenError when user is not an owner', async () => {
    const AccountMemberService = await loadService();
    const service = new AccountMemberService();

    prismaMock.account.findUnique.mockResolvedValue({ id: 'acc-3', user_id: 'owner-3' });
    prismaMock.accountMember.findUnique.mockResolvedValue({ role: 'member' });

    await expect(service.checkOwnerPermission('acc-3', 'user-3')).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
  });

  it('allows owner permission when member role is owner', async () => {
    const AccountMemberService = await loadService();
    const service = new AccountMemberService();

    prismaMock.account.findUnique.mockResolvedValue({ id: 'acc-4', user_id: 'owner-4' });
    prismaMock.accountMember.findUnique.mockResolvedValue({ role: 'owner' });

    await expect(service.checkOwnerPermission('acc-4', 'member-owner')).resolves.toBeUndefined();
  });

  it('validates invitation role before accessing the database', async () => {
    const AccountMemberService = await loadService();
    const service = new AccountMemberService();

    prismaMock.account.findUnique.mockResolvedValue({ id: 'acc-5', user_id: 'owner-5' });

    await expect(
      service.createInvitation('acc-5', 'owner-5', {
        email: 'user@example.com',
        role: 'invalid-role',
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });

    expect(prismaMock.accountInvitation.create).not.toHaveBeenCalled();
  });
});
