import { Response } from 'express';
import { AccountMemberService } from '../services/AccountMemberService';
import { AuthRequest } from '../types';
import { z } from 'zod';

const accountMemberService = new AccountMemberService();

// Schemas de validação
const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'member', 'viewer']),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'member', 'viewer']),
});

export class AccountMemberController {
  /**
   * GET /api/v1/accounts/:accountId/members
   * Lista todos os membros de uma conta
   */
  async listMembers(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { accountId } = req.params;
    const result = await accountMemberService.listMembers(accountId, req.user.userId);

    res.json(result);
  }

  /**
   * POST /api/v1/accounts/:accountId/invitations
   * Cria um convite para adicionar um membro à conta
   */
  async createInvitation(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { accountId } = req.params;
    const data = createInvitationSchema.parse(req.body);

    const invitation = await accountMemberService.createInvitation(
      accountId,
      req.user.userId,
      data
    );

    res.status(201).json(invitation);
  }

  /**
   * GET /api/v1/accounts/:accountId/invitations
   * Lista todos os convites de uma conta
   */
  async listInvitations(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { accountId } = req.params;
    const invitations = await accountMemberService.listInvitations(
      accountId,
      req.user.userId
    );

    res.json(invitations);
  }

  /**
   * GET /api/v1/invitations/my-invitations
   * Lista convites recebidos pelo usuário logado
   */
  async listMyInvitations(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const invitations = await accountMemberService.listMyInvitations(
      req.user.email
    );

    res.json(invitations);
  }

  /**
   * POST /api/v1/invitations/:token/accept
   * Aceita um convite
   */
  async acceptInvitation(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { token } = req.params;
    const result = await accountMemberService.acceptInvitation(
      token,
      req.user.userId
    );

    res.json(result);
  }

  /**
   * POST /api/v1/invitations/:token/reject
   * Rejeita um convite
   */
  async rejectInvitation(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { token } = req.params;
    const result = await accountMemberService.rejectInvitation(
      token,
      req.user.userId
    );

    res.json(result);
  }

  /**
   * PUT /api/v1/accounts/:accountId/members/:userId
   * Atualiza o role de um membro
   */
  async updateMemberRole(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { accountId, userId } = req.params;
    const { role } = updateMemberRoleSchema.parse(req.body);

    const member = await accountMemberService.updateMemberRole(
      accountId,
      req.user.userId,
      userId,
      role
    );

    res.json(member);
  }

  /**
   * DELETE /api/v1/accounts/:accountId/members/:userId
   * Remove um membro da conta
   */
  async removeMember(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { accountId, userId } = req.params;
    const result = await accountMemberService.removeMember(
      accountId,
      req.user.userId,
      userId
    );

    res.json(result);
  }
}
