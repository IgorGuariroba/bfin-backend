import prisma from '../lib/prisma';
import { ValidationError, ForbiddenError, NotFoundError } from '../middlewares/errorHandler';

const VALID_MEMBER_ROLES = ['owner', 'member', 'viewer'] as const;

export class AccountMemberService {
  private ensureValidRole(role: string) {
    if (!VALID_MEMBER_ROLES.includes(role as (typeof VALID_MEMBER_ROLES)[number])) {
      throw new ValidationError('Função inválida. Deve ser: owner, member ou viewer');
    }
  }

  /**
   * Verifica se o usuário tem acesso à conta (owner ou member)
   */
  async checkAccess(
    accountId: string,
    userId: string
  ): Promise<{
    hasAccess: boolean;
    role?: string;
  }> {
    // Verificar se é o dono da conta
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (account?.user_id === userId) {
      return { hasAccess: true, role: 'owner' };
    }

    // Verificar se é membro
    const member = await prisma.accountMember.findUnique({
      where: {
        account_id_user_id: {
          account_id: accountId,
          user_id: userId,
        },
      },
    });

    if (member) {
      return { hasAccess: true, role: member.role };
    }

    return { hasAccess: false };
  }

  /**
   * Verifica se o usuário tem permissão de owner
   */
  async checkOwnerPermission(accountId: string, userId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundError('Conta não encontrada');
    }

    if (account.user_id !== userId) {
      const member = await prisma.accountMember.findUnique({
        where: {
          account_id_user_id: {
            account_id: accountId,
            user_id: userId,
          },
        },
      });

      if (member?.role !== 'owner') {
        throw new ForbiddenError('Apenas proprietários da conta podem realizar esta ação');
      }
    }
  }

  /**
   * Lista todos os membros de uma conta
   */
  async listMembers(accountId: string, userId: string) {
    // Verificar se o usuário tem acesso à conta
    const access = await this.checkAccess(accountId, userId);
    if (!access.hasAccess) {
      throw new ForbiddenError('Acesso negado a esta conta');
    }

    // Buscar conta para pegar o dono original
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { user_id: true },
    });

    if (!account) {
      throw new NotFoundError('Conta não encontrada');
    }

    // Buscar todos os membros (incluindo owners)
    const members = await prisma.accountMember.findMany({
      where: { account_id: accountId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // owner primeiro
        { created_at: 'asc' },
      ],
    });

    return {
      original_owner_id: account.user_id,
      members,
    };
  }

  /**
   * Cria um convite para um membro
   */
  async createInvitation(
    accountId: string,
    requestUserId: string,
    data: {
      email: string;
      role: string;
    }
  ) {
    // Verificar se o usuário tem permissão de owner
    await this.checkOwnerPermission(accountId, requestUserId);

    // Validar role
    this.ensureValidRole(data.role);

    // Normalizar email
    const email = data.email.toLowerCase().trim();

    // Verificar se o email já é do dono da conta
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        user: true,
      },
    });

    if (account?.user.email.toLowerCase() === email) {
      throw new ValidationError('Não é possível convidar o proprietário da conta');
    }

    // Verificar se já é membro
    const existingMember = await prisma.user.findUnique({
      where: { email },
      include: {
        account_members: {
          where: {
            account_id: accountId,
          },
        },
      },
    });

    if (existingMember && existingMember.account_members.length > 0) {
      throw new ValidationError('Usuário já é membro desta conta');
    }

    // Verificar se já existe um convite pendente (válido)
    const existingValidInvitation = await prisma.accountInvitation.findFirst({
      where: {
        account_id: accountId,
        invited_email: email,
        status: 'pending',
        expires_at: { gt: new Date() },
      },
    });

    if (existingValidInvitation) {
      throw new ValidationError('Já foi enviado um convite para este email');
    }

    // Cancelar convites expirados anteriores para permitir reenvio
    await prisma.accountInvitation.updateMany({
      where: {
        account_id: accountId,
        invited_email: email,
        status: 'pending',
        expires_at: { lte: new Date() },
      },
      data: { status: 'expired' },
    });

    // Criar convite (válido por 7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.accountInvitation.create({
      data: {
        account_id: accountId,
        invited_email: email,
        invited_by: requestUserId,
        role: data.role,
        expires_at: expiresAt,
      },
      include: {
        account: {
          select: {
            account_name: true,
          },
        },
        inviter: {
          select: {
            full_name: true,
            email: true,
          },
        },
      },
    });

    return invitation;
  }

  /**
   * Atualiza o role de um membro
   */
  async updateMemberRole(
    accountId: string,
    requestUserId: string,
    targetUserId: string,
    newRole: string
  ) {
    // Verificar se o usuário tem permissão de owner
    await this.checkOwnerPermission(accountId, requestUserId);

    // Validar role
    this.ensureValidRole(newRole);

    // Não pode alterar o role do dono original
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (account?.user_id === targetUserId) {
      throw new ValidationError('Não é possível alterar a função do proprietário da conta');
    }

    // Buscar membro
    const member = await prisma.accountMember.findUnique({
      where: {
        account_id_user_id: {
          account_id: accountId,
          user_id: targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundError('Membro não encontrado');
    }

    // Atualizar role
    const updatedMember = await prisma.accountMember.update({
      where: {
        account_id_user_id: {
          account_id: accountId,
          user_id: targetUserId,
        },
      },
      data: {
        role: newRole,
        updated_at: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
      },
    });

    return updatedMember;
  }

  /**
   * Remove um membro da conta
   */
  async removeMember(accountId: string, requestUserId: string, targetUserId: string) {
    // Verificar se o usuário tem permissão de owner
    await this.checkOwnerPermission(accountId, requestUserId);

    // Não pode remover o dono original
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (account?.user_id === targetUserId) {
      throw new ValidationError('Não é possível remover o proprietário da conta');
    }

    // Buscar membro
    const member = await prisma.accountMember.findUnique({
      where: {
        account_id_user_id: {
          account_id: accountId,
          user_id: targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundError('Membro não encontrado');
    }

    // Remover membro
    await prisma.accountMember.delete({
      where: {
        account_id_user_id: {
          account_id: accountId,
          user_id: targetUserId,
        },
      },
    });

    return { message: 'Membro removido com sucesso' };
  }

  /**
   * Lista convites de uma conta
   */
  async listInvitations(accountId: string, requestUserId: string) {
    // Verificar se o usuário tem permissão de owner
    await this.checkOwnerPermission(accountId, requestUserId);

    const invitations = await prisma.accountInvitation.findMany({
      where: { account_id: accountId },
      include: {
        inviter: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return invitations;
  }

  /**
   * Lista convites recebidos por um usuário
   */
  async listMyInvitations(userEmail: string) {
    const invitations = await prisma.accountInvitation.findMany({
      where: {
        invited_email: userEmail.toLowerCase().trim(),
        status: 'pending',
        expires_at: {
          gte: new Date(), // Apenas convites não expirados
        },
      },
      include: {
        account: {
          select: {
            id: true,
            account_name: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return invitations;
  }

  /**
   * Aceita um convite
   */
  async acceptInvitation(token: string, userId: string) {
    // Buscar convite
    const invitation = await prisma.accountInvitation.findUnique({
      where: { token },
      include: {
        account: true,
      },
    });

    if (!invitation) {
      throw new NotFoundError('Convite não encontrado');
    }

    // Verificar se o convite está pendente
    if (invitation.status !== 'pending') {
      throw new ValidationError('Este convite já foi processado');
    }

    // Verificar se o convite expirou
    if (invitation.expires_at < new Date()) {
      throw new ValidationError('Este convite expirou');
    }

    // Verificar se o usuário que está aceitando é o convidado
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.email.toLowerCase() !== invitation.invited_email.toLowerCase()) {
      throw new ForbiddenError('Você não está autorizado a aceitar este convite');
    }

    // Verificar se já é membro
    const existingMember = await prisma.accountMember.findUnique({
      where: {
        account_id_user_id: {
          account_id: invitation.account_id,
          user_id: userId,
        },
      },
    });

    if (existingMember) {
      throw new ValidationError('Você já é membro desta conta');
    }

    // Criar membro e atualizar convite em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // Criar membro
      const member = await tx.accountMember.create({
        data: {
          account_id: invitation.account_id,
          user_id: userId,
          role: invitation.role,
        },
        include: {
          account: {
            select: {
              id: true,
              account_name: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              full_name: true,
            },
          },
        },
      });

      // Atualizar status do convite
      await tx.accountInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          updated_at: new Date(),
        },
      });

      return member;
    });

    return result;
  }

  /**
   * Rejeita um convite
   */
  async rejectInvitation(token: string, userId: string) {
    // Buscar convite
    const invitation = await prisma.accountInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundError('Convite não encontrado');
    }

    // Verificar se o convite está pendente
    if (invitation.status !== 'pending') {
      throw new ValidationError('Este convite já foi processado');
    }

    // Verificar se o convite expirou
    if (invitation.expires_at < new Date()) {
      throw new ValidationError('Este convite expirou');
    }

    // Verificar se o usuário que está rejeitando é o convidado
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.email.toLowerCase() !== invitation.invited_email.toLowerCase()) {
      throw new ForbiddenError('Você não está autorizado a rejeitar este convite');
    }

    // Atualizar status do convite
    const updatedInvitation = await prisma.accountInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'rejected',
        updated_at: new Date(),
      },
    });

    return { message: 'Convite rejeitado com sucesso', invitation: updatedInvitation };
  }
}
