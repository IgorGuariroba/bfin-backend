import { PrismaClient } from '@prisma/client';
import { ValidationError, InsufficientBalanceError, NotFoundError, ForbiddenError } from '../middlewares/errorHandler';
import { SuggestionEngine } from './SuggestionEngine';
import { AccountMemberService } from './AccountMemberService';

const prisma = new PrismaClient();
const accountMemberService = new AccountMemberService();

interface CreateIncomeDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
  dueDate?: Date;
  isRecurring?: boolean;
  recurrencePattern?: string;
}

interface CreateFixedExpenseDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
  dueDate: Date;
  isRecurring?: boolean;
  recurrencePattern?: string;
}

interface CreateVariableExpenseDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
}

export class TransactionService {
  /**
   * Processa uma receita aplicando regras automáticas (30/70)
   */
  async processIncome(userId: string, data: CreateIncomeDTO) {
    // Validações
    if (data.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar conta e verificar acesso
      const account = await tx.account.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Verificar acesso (owner ou membro convidado)
      const access = await accountMemberService.checkAccess(data.accountId, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Access denied to this account');
      }

      // 2. Buscar regras ativas
      const rules = await tx.financialRule.findMany({
        where: {
          account_id: data.accountId,
          is_active: true,
        },
        orderBy: { priority: 'asc' },
      });

      const emergencyRule = rules.find(r => r.rule_type === 'emergency_reserve');
      const reservePercentage = emergencyRule?.percentage ? Number(emergencyRule.percentage) : 30;

      // 3. Calcular divisão 30/70
      const reserveAmount = data.amount * (reservePercentage / 100);
      const availableAmount = data.amount - reserveAmount;

      // 4. Atualizar saldos da conta
      const updatedAccount = await tx.account.update({
        where: { id: data.accountId },
        data: {
          total_balance: { increment: data.amount },
          emergency_reserve: { increment: reserveAmount },
          available_balance: { increment: availableAmount },
          updated_at: new Date(),
        },
      });

      // 5. Criar transação
      const transaction = await tx.transaction.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'income',
          amount: data.amount,
          description: data.description,
          due_date: data.dueDate || new Date(),
          executed_date: new Date(),
          status: 'executed',
          is_recurring: data.isRecurring || false,
          recurrence_pattern: data.recurrencePattern,
        },
      });

      // 6. Criar snapshot de histórico
      await tx.balanceHistory.create({
        data: {
          account_id: data.accountId,
          transaction_id: transaction.id,
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
          change_reason: 'income_received',
        },
      });

      // 7. Invalidar cache de sugestão
      await SuggestionEngine.invalidateCache(data.accountId);

      return {
        transaction,
        breakdown: {
          total_received: data.amount,
          emergency_reserve: reserveAmount,
          available: availableAmount,
        },
        account_balances: {
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
        },
      };
    });
  }

  /**
   * Cria despesa fixa com bloqueio preventivo
   */
  async createFixedExpense(userId: string, data: CreateFixedExpenseDTO) {
    // Validações
    if (data.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    // Validate due date is not in the past (allow today)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    if (data.dueDate < today) {
      throw new ValidationError('Due date cannot be in the past');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar e validar conta
      const account = await tx.account.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Verificar acesso (owner ou membro convidado)
      const access = await accountMemberService.checkAccess(data.accountId, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Access denied to this account');
      }

      // 2. Verificar saldo disponível
      if (Number(account.available_balance) < data.amount) {
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: R$ ${account.available_balance}, Required: R$ ${data.amount}`
        );
      }

      // 3. Bloquear saldo preventivamente
      const updatedAccount = await tx.account.update({
        where: { id: data.accountId },
        data: {
          available_balance: { decrement: data.amount },
          locked_balance: { increment: data.amount },
          updated_at: new Date(),
        },
      });

      // 4. Criar transação com status 'locked'
      const transaction = await tx.transaction.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'fixed_expense',
          amount: data.amount,
          description: data.description,
          due_date: data.dueDate,
          status: 'locked',
          is_recurring: data.isRecurring || false,
          recurrence_pattern: data.recurrencePattern,
        },
      });

      // 5. Criar snapshot
      await tx.balanceHistory.create({
        data: {
          account_id: data.accountId,
          transaction_id: transaction.id,
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
          change_reason: 'expense_locked',
        },
      });

      // 6. Invalidar cache de sugestão
      await SuggestionEngine.invalidateCache(data.accountId);

      return {
        transaction,
        account_balances: {
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
        },
      };
    });
  }

  /**
   * Cria despesa variável com débito imediato
   */
  async createVariableExpense(userId: string, data: CreateVariableExpenseDTO) {
    // Validações
    if (data.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar conta
      const account = await tx.account.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Verificar acesso (owner ou membro convidado)
      const access = await accountMemberService.checkAccess(data.accountId, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Access denied to this account');
      }

      // 2. Verificar saldo disponível
      if (Number(account.available_balance) < data.amount) {
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: R$ ${account.available_balance}, Required: R$ ${data.amount}`
        );
      }

      // 3. Débito imediato
      const updatedAccount = await tx.account.update({
        where: { id: data.accountId },
        data: {
          total_balance: { decrement: data.amount },
          available_balance: { decrement: data.amount },
          updated_at: new Date(),
        },
      });

      // 4. Criar transação executada
      const transaction = await tx.transaction.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'variable_expense',
          amount: data.amount,
          description: data.description,
          due_date: new Date(),
          executed_date: new Date(),
          status: 'executed',
        },
      });

      // 5. Snapshot
      await tx.balanceHistory.create({
        data: {
          account_id: data.accountId,
          transaction_id: transaction.id,
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
          change_reason: 'expense_paid',
        },
      });

      // 6. Invalidar cache de sugestão
      await SuggestionEngine.invalidateCache(data.accountId);

      return {
        transaction,
        account_balances: {
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
        },
      };
    });
  }

  /**
   * Lista transações com filtros
   */
  async list(userId: string, filters: {
    accountId?: string;
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Construir where clause
    const where: any = {};

    // Se accountId fornecido, verificar acesso
    if (filters.accountId) {
      const account = await prisma.account.findUnique({
        where: { id: filters.accountId },
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Verificar acesso (owner ou membro convidado)
      const access = await accountMemberService.checkAccess(filters.accountId, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Access denied to this account');
      }

      where.account_id = filters.accountId;
    } else {
      // Buscar todas as contas do usuário (próprias + compartilhadas)
      const userAccounts = await prisma.account.findMany({
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
        select: { id: true },
      });

      where.account_id = {
        in: userAccounts.map(a => a.id),
      };
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.categoryId) {
      where.category_id = filters.categoryId;
    }

    if (filters.startDate || filters.endDate) {
      where.due_date = {};
      if (filters.startDate) {
        where.due_date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.due_date.lte = filters.endDate;
      }
    }

    // Buscar transações
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
              icon: true,
            },
          },
          account: {
            select: {
              id: true,
              account_name: true,
            },
          },
        },
        orderBy: [
          { due_date: 'desc' },
          { created_at: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: limit,
      },
    };
  }

  /**
   * Busca transação por ID
   */
  async getById(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        category: true,
        account: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Verificar acesso (owner ou membro convidado)
    const access = await accountMemberService.checkAccess(transaction.account_id, userId);
    if (!access.hasAccess) {
      throw new ForbiddenError('Access denied to this transaction');
    }

    return transaction;
  }

  /**
   * Atualiza uma transação (permite atualizar qualquer transação, revertendo se necessário)
   */
  async update(
    userId: string,
    transactionId: string,
    data: {
      amount?: number;
      description?: string;
      categoryId?: string;
      dueDate?: Date;
    }
  ) {
    const transaction = await this.getById(userId, transactionId);

    return await prisma.$transaction(async (tx) => {
      const oldAmount = Number(transaction.amount);
      const newAmount = data.amount ?? oldAmount;
      const amountDiff = newAmount - oldAmount;

      // Se o valor mudou, ajustar saldos conforme o tipo e status
      if (amountDiff !== 0) {
        if (transaction.status === 'locked') {
          // Despesa fixa bloqueada: ajustar bloqueio
          await tx.account.update({
            where: { id: transaction.account_id },
            data: {
              available_balance: { decrement: amountDiff },
              locked_balance: { increment: amountDiff },
            },
          });
        } else if (transaction.status === 'executed') {
          // Transação executada: ajustar conforme o tipo
          if (transaction.type === 'income') {
            // Receita: recalcular divisão 30/70
            const emergencyPercentage = 30;
            const oldReserve = oldAmount * (emergencyPercentage / 100);
            const oldAvailable = oldAmount - oldReserve;
            const newReserve = newAmount * (emergencyPercentage / 100);
            const newAvailable = newAmount - newReserve;

            await tx.account.update({
              where: { id: transaction.account_id },
              data: {
                total_balance: { increment: amountDiff },
                emergency_reserve: { increment: newReserve - oldReserve },
                available_balance: { increment: newAvailable - oldAvailable },
              },
            });
          } else {
            // Despesa variável: ajustar saldo total e disponível
            await tx.account.update({
              where: { id: transaction.account_id },
              data: {
                total_balance: { decrement: amountDiff },
                available_balance: { decrement: amountDiff },
              },
            });
          }
        }
      }

      // Atualizar transação
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          amount: data.amount,
          description: data.description,
          category_id: data.categoryId,
          due_date: data.dueDate,
        },
        include: {
          category: true,
          account: true,
        },
      });

      // Invalidar cache de sugestões se o valor mudou
      if (amountDiff !== 0) {
        await SuggestionEngine.invalidateCache(transaction.account_id);
      }

      return {
        transaction: updatedTransaction,
        message: 'Transaction updated successfully',
      };
    });
  }

  /**
   * Duplica uma transação (cria uma nova com os mesmos dados)
   */
  async duplicate(userId: string, transactionId: string) {
    const transaction = await this.getById(userId, transactionId);

    // Preparar dados para nova transação
    if (!transaction.category_id) {
      throw new ValidationError('Cannot duplicate transaction without a category');
    }

    const duplicateData = {
      accountId: transaction.account_id,
      categoryId: transaction.category_id,
      amount: Number(transaction.amount),
      description: `${transaction.description} (cópia)`,
      dueDate: new Date(),
      isRecurring: transaction.is_recurring,
      recurrencePattern: transaction.recurrence_pattern ?? undefined,
    };

    // Criar nova transação baseada no tipo original
    if (transaction.type === 'income') {
      return this.processIncome(userId, duplicateData);
    } else if (transaction.type === 'fixed_expense') {
      return this.createFixedExpense(userId, duplicateData);
    } else if (transaction.type === 'variable_expense') {
      return this.createVariableExpense(userId, {
        accountId: duplicateData.accountId,
        categoryId: duplicateData.categoryId,
        amount: duplicateData.amount,
        description: duplicateData.description,
      });
    }

    throw new ValidationError('Invalid transaction type');
  }

  /**
   * Marca uma despesa fixa como paga (executa o pagamento)
   */
  async markFixedExpenseAsPaid(userId: string, transactionId: string) {
    const transaction = await this.getById(userId, transactionId);

    // Só permite marcar como paga se for despesa fixa e estiver bloqueada
    if (transaction.type !== 'fixed_expense') {
      throw new ValidationError('Only fixed expenses can be marked as paid');
    }

    if (transaction.status !== 'locked') {
      throw new ValidationError('Transaction is not locked');
    }

    const amount = Number(transaction.amount);

    return await prisma.$transaction(async (tx) => {
      // Transferir do bloqueado para débito efetivo
      await tx.account.update({
        where: { id: transaction.account_id },
        data: {
          total_balance: { decrement: amount },
          locked_balance: { decrement: amount },
        },
      });

      // Atualizar transação como executada
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'executed',
          executed_date: new Date(),
        },
        include: {
          category: true,
          account: true,
        },
      });

      // Buscar saldos atualizados da conta
      const updatedAccount = await tx.account.findUnique({
        where: { id: transaction.account_id },
        select: {
          total_balance: true,
          available_balance: true,
          locked_balance: true,
          emergency_reserve: true,
        },
      });

      // Criar snapshot de histórico
      await tx.balanceHistory.create({
        data: {
          account_id: transaction.account_id,
          transaction_id: transactionId,
          total_balance: updatedAccount!.total_balance,
          available_balance: updatedAccount!.available_balance,
          locked_balance: updatedAccount!.locked_balance,
          emergency_reserve: updatedAccount!.emergency_reserve,
          change_reason: 'fixed_expense_paid',
        },
      });

      // Invalidar cache de sugestões
      await SuggestionEngine.invalidateCache(transaction.account_id);

      return {
        transaction: updatedTransaction,
        message: 'Fixed expense marked as paid successfully',
      };
    });
  }

  /**
   * Deleta uma transação (permite deletar qualquer transação, revertendo os efeitos)
   */
  async delete(userId: string, transactionId: string) {
    const transaction = await this.getById(userId, transactionId);
    const amount = Number(transaction.amount);

    return await prisma.$transaction(async (tx) => {
      // Reverter efeitos nos saldos conforme o tipo e status
      if (transaction.status === 'locked') {
        // Despesa fixa bloqueada: liberar o bloqueio
        await tx.account.update({
          where: { id: transaction.account_id },
          data: {
            available_balance: { increment: amount },
            locked_balance: { decrement: amount },
          },
        });
      } else if (transaction.status === 'executed') {
        // Transação executada: reverter conforme o tipo
        if (transaction.type === 'income') {
          // Receita: reverter divisão 30/70
          const emergencyPercentage = 30;
          const reserveAmount = amount * (emergencyPercentage / 100);
          const availableAmount = amount - reserveAmount;

          await tx.account.update({
            where: { id: transaction.account_id },
            data: {
              total_balance: { decrement: amount },
              emergency_reserve: { decrement: reserveAmount },
              available_balance: { decrement: availableAmount },
            },
          });
        } else {
          // Despesa variável: devolver o valor
          await tx.account.update({
            where: { id: transaction.account_id },
            data: {
              total_balance: { increment: amount },
              available_balance: { increment: amount },
            },
          });
        }
      }

      // Deletar transação
      await tx.transaction.delete({
        where: { id: transactionId },
      });

      // Invalidar cache de sugestões
      await SuggestionEngine.invalidateCache(transaction.account_id);

      return { message: 'Transaction deleted successfully' };
    });
  }
}
