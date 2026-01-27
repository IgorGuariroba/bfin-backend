import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountMemberController } from '../../src/controllers/AccountMemberController';
import { AccountMemberService } from '../../src/services/AccountMemberService';
import type { AuthRequest } from '../../src/types';

vi.mock('../../src/services/AccountMemberService');

describe('AccountMemberController Unit Tests', () => {
  let controller: AccountMemberController;
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;
  let mockService: ReturnType<typeof vi.mocked<typeof AccountMemberService>>['prototype'];

  beforeEach(() => {
    vi.clearAllMocks();

    json = vi.fn();
    status = vi.fn().mockReturnValue({ json });
    res = {
      status,
      json,
    } as unknown as Response;

    req = {
      params: { accountId: 'acc-1', userId: 'user-2', token: 'token-1' },
      body: {},
      user: { userId: 'user-1', email: 'user1@example.com' },
    } as unknown as AuthRequest;

    controller = new AccountMemberController();
    mockService = vi.mocked(AccountMemberService).prototype;
  });

  describe('authorization checks', () => {
    it('listMembers should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.listMembers(req as AuthRequest, res as Response);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('createInvitation should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.createInvitation(req as AuthRequest, res as Response);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('listInvitations should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.listInvitations(req as AuthRequest, res as Response);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('listMyInvitations should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.listMyInvitations(req as AuthRequest, res as Response);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('acceptInvitation should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.acceptInvitation(req as AuthRequest, res as Response);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('rejectInvitation should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.rejectInvitation(req as AuthRequest, res as Response);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('updateMemberRole should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.updateMemberRole(req as AuthRequest, res as Response);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('removeMember should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.removeMember(req as AuthRequest, res as Response);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('happy paths', () => {
    it('listMembers should call service and return json', async () => {
      const serviceResult = { original_owner_id: 'user-1', members: [] };
      mockService.listMembers.mockResolvedValue(serviceResult);

      await controller.listMembers(req as AuthRequest, res as Response);

      expect(mockService.listMembers).toHaveBeenCalledWith('acc-1', 'user-1');
      expect(json).toHaveBeenCalledWith(serviceResult);
    });

    it('createInvitation should validate, call service, and return 201', async () => {
      req.body = { email: 'invitee@example.com', role: 'member' };
      const invitation = { id: 'inv-1' };
      mockService.createInvitation.mockResolvedValue(invitation);

      await controller.createInvitation(req as AuthRequest, res as Response);

      expect(mockService.createInvitation).toHaveBeenCalledWith('acc-1', 'user-1', {
        email: 'invitee@example.com',
        role: 'member',
      });
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(invitation);
    });

    it('listInvitations should call service and return json', async () => {
      const invitations = [{ id: 'inv-1' }];
      mockService.listInvitations.mockResolvedValue(invitations);

      await controller.listInvitations(req as AuthRequest, res as Response);

      expect(mockService.listInvitations).toHaveBeenCalledWith('acc-1', 'user-1');
      expect(json).toHaveBeenCalledWith(invitations);
    });

    it('listMyInvitations should call service with user email', async () => {
      const invitations = [{ id: 'inv-1' }];
      mockService.listMyInvitations.mockResolvedValue(invitations);

      await controller.listMyInvitations(req as AuthRequest, res as Response);

      expect(mockService.listMyInvitations).toHaveBeenCalledWith('user1@example.com');
      expect(json).toHaveBeenCalledWith(invitations);
    });

    it('acceptInvitation should call service and return json', async () => {
      const result = { success: true };
      mockService.acceptInvitation.mockResolvedValue(result);

      await controller.acceptInvitation(req as AuthRequest, res as Response);

      expect(mockService.acceptInvitation).toHaveBeenCalledWith('token-1', 'user-1');
      expect(json).toHaveBeenCalledWith(result);
    });

    it('rejectInvitation should call service and return json', async () => {
      const result = { success: true };
      mockService.rejectInvitation.mockResolvedValue(result);

      await controller.rejectInvitation(req as AuthRequest, res as Response);

      expect(mockService.rejectInvitation).toHaveBeenCalledWith('token-1', 'user-1');
      expect(json).toHaveBeenCalledWith(result);
    });

    it('updateMemberRole should validate, call service, and return json', async () => {
      req.body = { role: 'viewer' };
      const member = { user_id: 'user-2', role: 'viewer' };
      mockService.updateMemberRole.mockResolvedValue(member);

      await controller.updateMemberRole(req as AuthRequest, res as Response);

      expect(mockService.updateMemberRole).toHaveBeenCalledWith(
        'acc-1',
        'user-1',
        'user-2',
        'viewer'
      );
      expect(json).toHaveBeenCalledWith(member);
    });

    it('removeMember should call service and return json', async () => {
      const result = { success: true };
      mockService.removeMember.mockResolvedValue(result);

      await controller.removeMember(req as AuthRequest, res as Response);

      expect(mockService.removeMember).toHaveBeenCalledWith('acc-1', 'user-1', 'user-2');
      expect(json).toHaveBeenCalledWith(result);
    });
  });
});
