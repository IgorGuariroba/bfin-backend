import { describe, expect, it, vi, beforeEach } from 'vitest';
import prisma from '../../src/lib/prisma';
import { ValidationError, ForbiddenError, NotFoundError } from '../../src/middlewares/errorHandler';
import { AccountMemberService } from '../../src/services/AccountMemberService';

vi.mock('../../src/lib/prisma', () => ({
  default: {
    account: {
      findUnique: vi.fn(),
    },
    accountMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    accountInvitation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('AccountMemberService', () => {
  let service: AccountMemberService;
  const mockAccount = {
    id: 'account-1',
    user_id: 'user-1',
    account_name: 'Test Account',
  };

  const mockMember = {
    id: 'member-1',
    account_id: 'account-1',
    user_id: 'user-2',
    role: 'member',
    user: {
      id: 'user-2',
      email: 'member@example.com',
      full_name: 'Test Member',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountMemberService();
  });

  describe('checkAccess', () => {
    it('should return owner role when user is account owner', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount as any);

      const result = await service.checkAccess('account-1', 'user-1');

      expect(result).toEqual({ hasAccess: true, role: 'owner' });
    });

    it('should return member role when user is a member', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.accountMember.findUnique).mockResolvedValue(mockMember as any);

      const result = await service.checkAccess('account-1', 'user-2');

      expect(result).toEqual({ hasAccess: true, role: 'member' });
    });

    it('should return no access when user is not owner or member', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.accountMember.findUnique).mockResolvedValue(null);

      const result = await service.checkAccess('account-1', 'user-3');

      expect(result).toEqual({ hasAccess: false });
    });
  });

  describe('checkOwnerPermission', () => {
    it('should not throw when user is account owner', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount as any);

      await expect(service.checkOwnerPermission('account-1', 'user-1')).resolves.not.toThrow();
    });

    it('should throw NotFoundError when account does not exist', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);

      await expect(service.checkOwnerPermission('account-1', 'user-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ForbiddenError when user is not owner', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        ...mockAccount,
        user_id: 'other-user',
      } as any);
      vi.mocked(prisma.accountMember.findUnique).mockResolvedValue(null);

      await expect(service.checkOwnerPermission('account-1', 'user-2')).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('listMembers', () => {
    it('should list all members including original owner', async () => {
      vi.mocked(prisma.account.findUnique)
        .mockResolvedValueOnce({ id: 'account-1', user_id: 'user-1' } as any)
        .mockResolvedValueOnce({ user_id: 'user-1' } as any);
      vi.mocked(prisma.accountMember.findMany).mockResolvedValue([mockMember] as any);

      const result = await service.listMembers('account-1', 'user-1');

      expect(result).toHaveProperty('original_owner_id');
      expect(result).toHaveProperty('members');
    });

    it('should throw ForbiddenError when user has no access', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount as any);
      vi.mocked(prisma.accountMember.findUnique).mockResolvedValue(null);

      await expect(service.listMembers('account-1', 'user-3')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('createInvitation', () => {
    const invitationData = {
      email: 'newmember@example.com',
      role: 'member',
    };

    it('should throw ForbiddenError when user is not owner', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        ...mockAccount,
        user_id: 'other-user',
      } as any);
      vi.mocked(prisma.accountMember.findUnique).mockResolvedValue(null);

      await expect(service.createInvitation('account-1', 'user-2', invitationData)).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw ValidationError for invalid role', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount as any);

      await expect(
        service.createInvitation('account-1', 'user-1', {
          email: 'test@example.com',
          role: 'invalid',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateMemberRole', () => {
    it('should throw ForbiddenError when user is not owner', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        ...mockAccount,
        user_id: 'other-user',
      } as any);
      vi.mocked(prisma.accountMember.findUnique).mockResolvedValue(null);

      await expect(
        service.updateMemberRole('account-1', 'user-2', 'user-3', 'owner')
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError for invalid role', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount as any);

      await expect(
        service.updateMemberRole('account-1', 'user-1', 'user-2', 'invalid')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('removeMember', () => {
    it('should throw ForbiddenError when user is not owner', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        ...mockAccount,
        user_id: 'other-user',
      } as any);
      vi.mocked(prisma.accountMember.findUnique).mockResolvedValue(null);

      await expect(service.removeMember('account-1', 'user-2', 'user-3')).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('listInvitations', () => {
    it('should list all invitations for account', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount as any);
      vi.mocked(prisma.accountInvitation.findMany).mockResolvedValue([
        { id: 'invitation-1', invited_email: 'test@example.com' },
      ] as any);

      const result = await service.listInvitations('account-1', 'user-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw ForbiddenError when user is not owner', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        ...mockAccount,
        user_id: 'other-user',
      } as any);
      vi.mocked(prisma.accountMember.findUnique).mockResolvedValue(null);

      await expect(service.listInvitations('account-1', 'user-2')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('listMyInvitations', () => {
    it('should list pending invitations for user email', async () => {
      const mockInvitations = [
        {
          id: 'invitation-1',
          invited_email: 'user@example.com',
          status: 'pending',
          account: { id: 'account-1', account_name: 'Test Account' },
        },
      ];
      vi.mocked(prisma.accountInvitation.findMany).mockResolvedValue(mockInvitations as any);

      const result = await service.listMyInvitations('user@example.com');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('acceptInvitation', () => {
    const mockInvitation = {
      id: 'invitation-1',
      token: 'token-123',
      status: 'pending',
      account_id: 'account-1',
      invited_email: 'user@example.com',
      role: 'member',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      account: mockAccount,
    };

    it('should throw NotFoundError when invitation does not exist', async () => {
      vi.mocked(prisma.accountInvitation.findUnique).mockResolvedValue(null);

      await expect(service.acceptInvitation('invalid-token', 'user-2')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ValidationError when invitation is not pending', async () => {
      vi.mocked(prisma.accountInvitation.findUnique).mockResolvedValue({
        ...mockInvitation,
        status: 'accepted',
      } as any);

      await expect(service.acceptInvitation('token-123', 'user-2')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ForbiddenError when user email does not match invitation', async () => {
      vi.mocked(prisma.accountInvitation.findUnique).mockResolvedValue(mockInvitation as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-2',
        email: 'different@example.com',
      } as any);

      await expect(service.acceptInvitation('token-123', 'user-2')).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw ValidationError when user is already a member', async () => {
      vi.mocked(prisma.accountInvitation.findUnique).mockResolvedValue(mockInvitation as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-2',
        email: 'user@example.com',
      } as any);
      vi.mocked(prisma.accountMember.findUnique).mockResolvedValue({
        id: 'member-1',
        account_id: 'account-1',
        user_id: 'user-2',
      } as any);

      await expect(service.acceptInvitation('token-123', 'user-2')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('rejectInvitation', () => {
    const mockInvitation = {
      id: 'invitation-1',
      token: 'token-123',
      status: 'pending',
      invited_email: 'user@example.com',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    it('should throw NotFoundError when invitation does not exist', async () => {
      vi.mocked(prisma.accountInvitation.findUnique).mockResolvedValue(null);

      await expect(service.rejectInvitation('invalid-token', 'user-2')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ValidationError when invitation is not pending', async () => {
      vi.mocked(prisma.accountInvitation.findUnique).mockResolvedValue({
        ...mockInvitation,
        status: 'accepted',
      } as any);

      await expect(service.rejectInvitation('token-123', 'user-2')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when invitation is expired', async () => {
      vi.mocked(prisma.accountInvitation.findUnique).mockResolvedValue({
        ...mockInvitation,
        expires_at: new Date(Date.now() - 1000),
      } as any);

      await expect(service.rejectInvitation('token-123', 'user-2')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ForbiddenError when user email does not match invitation', async () => {
      vi.mocked(prisma.accountInvitation.findUnique).mockResolvedValue(mockInvitation as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-2',
        email: 'different@example.com',
      } as any);

      await expect(service.rejectInvitation('token-123', 'user-2')).rejects.toThrow(
        ForbiddenError
      );
    });
  });
});
