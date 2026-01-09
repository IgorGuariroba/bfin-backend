import { PrismaClient } from '@prisma/client';
import { ValidationError, ForbiddenError, NotFoundError } from '../middlewares/errorHandler';
import { CreateAccountDTO, UpdateAccountDTO } from '../types';
import { AccountMemberService } from './AccountMemberService';

const prisma = new PrismaClient();
const accountMemberService = new AccountMemberService();

export class AccountService {
  /**
   * Lista todas as contas de um usuário (próprias + compartilhadas)
   */
  async listByUser(userId: string) {
    // Buscar todas as contas onde o usuário é membro (incluindo owner)
    const accounts = await prisma.account.findMany({
      where: {
        OR: [
          { user_id: userId }, // Contas próprias
          {
            members: {
              some: {
                user_id: userId,
              },
            },
          }, // Contas compartilhadas
        ],
      },
      include: {
        members: true, // Incluir TODOS os membros para verificar se é compartilhada
      },
      orderBy: [
        { is_default: 'desc' },
        { created_at: 'asc' },
      ],
    });

    // Mapear para adicionar informações de role
    const accountsWithRole = accounts.map((account) => {
      // Se é o dono original da conta
      const isOwner = account.user_id === userId;

      // Verificar role em account_members
      const userMembership = account.members.find(m => m.user_id === userId);
      const membershipRole = userMembership?.role;

      // Determinar role e se é compartilhada
      const user_role = isOwner ? 'owner' : (membershipRole || 'member');

      // Conta é compartilhada se:
      // 1. Usuário não é o dono original (está como membro de outra pessoa), OU
      // 2. Tem outros membros além do próprio dono
      const is_shared = !isOwner || account.members.length > 1;

      return {
        id: account.id,
        account_name: account.account_name,
        account_type: account.account_type,
        total_balance: account.total_balance,
        available_balance: account.available_balance,
        locked_balance: account.locked_balance,
        emergency_reserve: account.emergency_reserve,
        currency: account.currency,
        is_default: account.is_default,
        created_at: account.created_at,
        updated_at: account.updated_at,
        user_role: user_role as 'owner' | 'member',
        is_shared: is_shared,
      };
    });

    return accountsWithRole;
  }

  /**
   * Busca uma conta específica
   */
  async getById(accountId: string, userId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        financial_rules: {
          where: { is_active: true },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // Verificar se a conta pertence ao usuário ou se ele é membro
    const access = await accountMemberService.checkAccess(accountId, userId);
    if (!access.hasAccess) {
      throw new ForbiddenError('Access denied to this account');
    }

    return account;
  }

  /**
   * Cria uma nova conta
   */
  async create(userId: string, data: CreateAccountDTO) {
    // Validar dados
    if (!data.account_name || data.account_name.trim().length === 0) {
      throw new ValidationError('Account name is required');
    }

    // Se é para ser padrão, remover padrão das outras
    if (data.is_default) {
      await prisma.account.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      });
    }

    // Criar conta e regra de reserva em transação
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          user_id: userId,
          account_name: data.account_name,
          account_type: data.account_type || 'checking',
          is_default: data.is_default ?? false,
        },
      });

      // Criar regra de reserva de emergência padrão
      await tx.financialRule.create({
        data: {
          account_id: account.id,
          rule_type: 'emergency_reserve',
          rule_name: 'Reserva de Emergência Automática',
          percentage: 30,
          priority: 1,
          is_active: true,
        },
      });

      // Adicionar criador como owner em account_members
      await tx.accountMember.create({
        data: {
          account_id: account.id,
          user_id: userId,
          role: 'owner',
        },
      });

      return account;
    });

    return result;
  }

  /**
   * Atualiza uma conta
   */
  async update(accountId: string, userId: string, data: UpdateAccountDTO) {
    // Verificar se conta existe e usuário tem permissão de owner
    await this.getById(accountId, userId);
    await accountMemberService.checkOwnerPermission(accountId, userId);

    // Se está definindo como padrão, remover padrão das outras
    if (data.is_default) {
      await prisma.account.updateMany({
        where: { user_id: userId, is_default: true, id: { not: accountId } },
        data: { is_default: false },
      });
    }

    const account = await prisma.account.update({
      where: { id: accountId },
      data: {
        account_name: data.account_name,
        is_default: data.is_default,
        updated_at: new Date(),
      },
    });

    return account;
  }

  /**
   * Deleta uma conta (apenas se não tiver transações)
   */
  async delete(accountId: string, userId: string) {
    // Verificar se conta existe e usuário tem permissão de owner
    const account = await this.getById(accountId, userId);
    await accountMemberService.checkOwnerPermission(accountId, userId);

    // Verificar se tem transações
    const transactionCount = await prisma.transaction.count({
      where: { account_id: accountId },
    });

    if (transactionCount > 0) {
      throw new ValidationError(
        'Cannot delete account with transactions. Please transfer or delete all transactions first.'
      );
    }

    // Verificar se tem saldo
    if (Number(account.total_balance) !== 0) {
      throw new ValidationError('Cannot delete account with non-zero balance');
    }

    // Deletar conta (cascade vai deletar regras e histórico)
    await prisma.account.delete({
      where: { id: accountId },
    });

    return { message: 'Account deleted successfully' };
  }

  /**
   * Busca conta padrão do usuário
   */
  async getDefaultAccount(userId: string) {
    const account = await prisma.account.findFirst({
      where: { user_id: userId, is_default: true },
    });

    if (!account) {
      // Se não tem padrão, pegar a primeira
      const firstAccount = await prisma.account.findFirst({
        where: { user_id: userId },
      });

      if (!firstAccount) {
        throw new NotFoundError('No accounts found for this user');
      }

      return firstAccount;
    }

    return account;
  }
}
