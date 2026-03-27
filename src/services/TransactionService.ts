import { AccountMemberService } from './AccountMemberService';
import { SuggestionEngine } from './SuggestionEngine';
import type { Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import {
  ValidationError,
  InsufficientBalanceError,
  NotFoundError,
  ForbiddenError,
} from '../middlewares/errorHandler';

const accountMemberService = new AccountMemberService();

interface CreateIncomeDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
  dueDate?: Date;
  isRecurring?: boolean;
  recurrencePattern?: 'monthly' | 'weekly' | 'yearly';
  recurrenceInterval?: number | null;
  recurrenceCount?: number | null;
  recurrenceEndDate?: Date | null;
  indefinite?: boolean;
}

interface CreateFixedExpenseDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
  type: 'fixed';
  dueDate?: Date;
  isRecurring?: boolean;
  recurrencePattern?: 'monthly' | 'weekly' | 'yearly';
  recurrenceInterval?: number | null; // Intervalo entre repetições (ex: 3 = de 3 em 3 meses)
  recurrenceCount?: number | null;
  recurrenceEndDate?: Date | null;
  indefinite?: boolean;
  isFloating?: boolean; // true = dívida sem data de vencimento
}

interface CreateVariableExpenseDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
  type: 'variable';
  dueDate?: Date;
}

export class TransactionService {
  /**
   * Invalida o cache do calendário para uma conta específica
   */
  private async invalidateCalendarCache(accountId: string): Promise<void> {
    const stream = redis.scanStream({
      match: `calendar:${accountId}:*`,
    });

    stream.on('data', (keys) => {
      if (keys.length) {
        const pipeline = redis.pipeline();
        keys.forEach((key: string) => {
          pipeline.del(key);
        });
        pipeline.exec();
      }
    });
  }

  /**
   * Processa uma receita.
   *
   * - Se dueDate for no futuro: cria como PENDING (agendada) sem afetar saldo.
   *   O saldo é atualizado quando marcada como recebida via markIncomeAsReceived().
   * - Se dueDate for hoje/passado (ou não informada): executa imediatamente (30/70).
   *
   * Em ambos os casos, se for recorrente gera instâncias futuras como PENDING.
   */
  async processIncome(userId: string, data: CreateIncomeDTO) {
    if (data.amount <= 0) {
      throw new ValidationError('O valor deve ser positivo');
    }

    const dueDate = data.dueDate || new Date();
    // Só é agendada se dueDate foi explicitamente informado E é estritamente no futuro (após hoje)
    // Usa UTC para evitar problemas de fuso horário quando o servidor está em país diferente do usuário
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const isScheduled = data.dueDate !== undefined && dueDate >= tomorrow;

    if (data.isRecurring) {
      const hasRecurrenceCount =
        data.recurrenceCount !== undefined && data.recurrenceCount !== null;
      const hasRecurrenceEnd =
        data.recurrenceEndDate !== undefined && data.recurrenceEndDate !== null;
      const hasIndefinite = data.indefinite === true;
      const opts = [hasRecurrenceCount, hasRecurrenceEnd, hasIndefinite].filter(Boolean);
      if (opts.length > 1) {
        throw new ValidationError(
          'Apenas um tipo de fim de recorrência é permitido: recurrenceCount, recurrenceEndDate ou indefinite'
        );
      }
      if (opts.length === 0) {
        data.indefinite = true;
      }
    }

    return await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { id: data.accountId } });
      if (!account) {
        throw new NotFoundError('Conta não encontrada');
      }

      const access = await accountMemberService.checkAccess(data.accountId, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Acesso negado a esta conta');
      }

      // ── Receita agendada (data futura): não mexe no saldo ─────────────────
      if (isScheduled) {
        const transaction = await tx.transaction.create({
          data: {
            account_id: data.accountId,
            category_id: data.categoryId,
            type: 'income',
            amount: data.amount,
            description: data.description,
            due_date: dueDate,
            status: 'pending',
            is_recurring: data.isRecurring || false,
            recurrence_pattern: data.recurrencePattern,
            recurrence_interval: data.recurrenceInterval ?? undefined,
            recurrence_count: data.recurrenceCount ?? undefined,
            recurrence_end_date: data.recurrenceEndDate ?? undefined,
            indefinite: data.indefinite ?? false,
          },
        });

        if (data.isRecurring && data.recurrencePattern) {
          await this.generateIncomeInstances(tx, {
            ...data,
            dueDate,
            parentTransactionId: transaction.id,
          });
        }

        this.invalidateCalendarCache(data.accountId);
        return { transaction };
      }

      // ── Receita imediata: executa e aplica regra 30/70 ────────────────────
      const rules = await tx.financialRule.findMany({
        where: { account_id: data.accountId, is_active: true },
        orderBy: { priority: 'asc' },
      });

      const emergencyRule = rules.find((r) => r.rule_type === 'emergency_reserve');
      const reservePercentage = emergencyRule?.percentage ? Number(emergencyRule.percentage) : 30;
      const reserveAmount = data.amount * (reservePercentage / 100);
      const availableAmount = data.amount - reserveAmount;

      const updatedAccount = await tx.account.update({
        where: { id: data.accountId },
        data: {
          total_balance: { increment: data.amount },
          emergency_reserve: { increment: reserveAmount },
          available_balance: { increment: availableAmount },
          updated_at: new Date(),
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'income',
          amount: data.amount,
          description: data.description,
          due_date: dueDate,
          executed_date: new Date(),
          status: 'executed',
          is_recurring: data.isRecurring || false,
          recurrence_pattern: data.recurrencePattern,
          recurrence_interval: data.recurrenceInterval ?? undefined,
          recurrence_count: data.recurrenceCount ?? undefined,
          recurrence_end_date: data.recurrenceEndDate ?? undefined,
          indefinite: data.indefinite ?? false,
        },
      });

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

      // Gerar instâncias futuras se recorrente
      if (data.isRecurring && data.recurrencePattern) {
        await this.generateIncomeInstances(tx, {
          ...data,
          dueDate,
          parentTransactionId: transaction.id,
        });
      }

      await SuggestionEngine.invalidateCache(data.accountId);
      this.invalidateCalendarCache(data.accountId);

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
   * Gera instâncias futuras pendentes para uma receita recorrente
   */
  private async generateIncomeInstances(
    tx: typeof prisma,
    data: CreateIncomeDTO & { dueDate: Date; parentTransactionId: string }
  ): Promise<void> {
    const instances: Prisma.TransactionUncheckedCreateInput[] = [];
    const dueDate = new Date(data.dueDate);
    const interval = data.recurrenceInterval ?? 1;

    let totalInstances = 0;
    if (data.indefinite) {
      totalInstances = 12;
    } else if (data.recurrenceCount !== undefined && data.recurrenceCount !== null) {
      totalInstances = data.recurrenceCount - 1;
    } else if (data.recurrenceEndDate) {
      const diffTime = data.recurrenceEndDate.getTime() - dueDate.getTime();
      totalInstances = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
    }

    for (let i = 1; i <= totalInstances; i++) {
      const nextDueDate = this.addPeriods(dueDate, data.recurrencePattern!, i * interval);
      if (data.recurrenceEndDate && nextDueDate > data.recurrenceEndDate) {
        break;
      }

      instances.push({
        account_id: data.accountId,
        category_id: data.categoryId,
        type: 'income',
        amount: data.amount,
        description: data.description,
        due_date: nextDueDate,
        status: 'pending',
        is_recurring: true,
        recurrence_pattern: data.recurrencePattern,
        recurrence_interval: data.recurrenceInterval ?? undefined,
        recurrence_count: data.recurrenceCount ?? undefined,
        recurrence_end_date: data.recurrenceEndDate ?? undefined,
        indefinite: data.indefinite ?? false,
        parent_transaction_id: data.parentTransactionId,
      });
    }

    if (instances.length > 0) {
      await tx.transaction.createMany({ data: instances });
    }
  }

  /**
   * Cria despesa fixa com bloqueio preventivo.
   *
   * Se isFloating=true: cria sem data de vencimento e sem bloquear saldo.
   * A dívida será abatida na projeção com o excedente de saldo disponível.
   */
  async createFixedExpense(userId: string, data: CreateFixedExpenseDTO) {
    if (data.amount <= 0) {
      throw new ValidationError('O valor deve ser positivo');
    }

    // ── Dívida flutuante (sem data) ──────────────────────────────────────────
    if (data.isFloating) {
      const account = await prisma.account.findUnique({ where: { id: data.accountId } });
      if (!account) {
        throw new NotFoundError('Conta não encontrada');
      }

      const access = await accountMemberService.checkAccess(data.accountId, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Acesso negado a esta conta');
      }

      const transaction = await prisma.transaction.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'fixed_expense',
          amount: data.amount,
          description: data.description,
          is_floating: true,
          due_date: null,
          status: 'pending',
        },
      });

      this.invalidateCalendarCache(data.accountId);
      return { transaction };
    }

    // dueDate é obrigatório para despesa fixa com data
    if (!data.dueDate) {
      throw new ValidationError('dueDate é obrigatório para despesas fixas');
    }

    // Validação de recorrência: não pode ter mais de um tipo de fim
    if (data.isRecurring) {
      const hasRecurrenceCount =
        data.recurrenceCount !== undefined && data.recurrenceCount !== null;
      const hasRecurrenceEnd =
        data.recurrenceEndDate !== undefined && data.recurrenceEndDate !== null;
      const hasIndefinite = data.indefinite === true;

      const recurrenceOptions = [hasRecurrenceCount, hasRecurrenceEnd, hasIndefinite].filter(
        Boolean
      );
      if (recurrenceOptions.length > 1) {
        throw new ValidationError(
          'Apenas um tipo de fim de recorrência é permitido: recurrenceCount, recurrenceEndDate ou indefinite'
        );
      }

      // Se é recorrente mas não especificou fim, assume indefinido
      if (recurrenceOptions.length === 0) {
        data.indefinite = true;
      }
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar e validar conta
      const account = await tx.account.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new NotFoundError('Conta não encontrada');
      }

      // Verificar acesso (owner ou membro convidado)
      const access = await accountMemberService.checkAccess(data.accountId, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Acesso negado a esta conta');
      }

      // 2. Verificar saldo disponível
      if (Number(account.available_balance) < data.amount) {
        throw new InsufficientBalanceError(
          `Saldo insuficiente. Disponível: R$ ${account.available_balance}, Necessário: R$ ${data.amount}`
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

      // 4. Criar transação principal com status 'locked'
      const transaction = await tx.transaction.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'fixed_expense',
          amount: data.amount,
          description: data.description,
          due_date: data.dueDate!,
          status: 'locked',
          is_recurring: data.isRecurring || false,
          recurrence_pattern: data.recurrencePattern,
          recurrence_interval: data.recurrenceInterval ?? undefined,
          recurrence_count: data.recurrenceCount ?? undefined,
          recurrence_end_date: data.recurrenceEndDate ?? undefined,
          indefinite: data.indefinite ?? false,
        },
      });

      // 5. Se for recorrente, gerar parcelas futuras
      if (data.isRecurring && data.recurrencePattern) {
        await this.generateRecurringInstallments(tx as typeof prisma, {
          ...data,
          parentTransactionId: transaction.id,
        });
      }

      // 6. Criar snapshot
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

      // 7. Invalidar cache de sugestão
      await SuggestionEngine.invalidateCache(data.accountId);
      this.invalidateCalendarCache(data.accountId);

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
   * Gera parcelas futuras para uma despesa recorrente
   */
  private async generateRecurringInstallments(
    tx: typeof prisma,
    data: CreateFixedExpenseDTO & { parentTransactionId: string }
  ): Promise<void> {
    const installments: Prisma.TransactionUncheckedCreateInput[] = [];
    const dueDate = new Date(data.dueDate!);

    // Intervalo padrão é 1 (mensal, semanal, etc.)
    const interval = data.recurrenceInterval ?? 1;

    // Calcular número de parcelas
    let totalInstallments = 0;

    if (data.indefinite) {
      // Para despesas indefinidas, gerar 12 parcelas futuras
      totalInstallments = 12;
    } else if (data.recurrenceCount !== undefined && data.recurrenceCount !== null) {
      // Despesa com número fixo de repetições (subtrai 1 porque a primeira já foi criada)
      totalInstallments = data.recurrenceCount - 1;
    } else if (data.recurrenceEndDate) {
      // Despesa com data final
      const endDate = new Date(data.recurrenceEndDate);
      const diffTime = endDate.getTime() - dueDate.getTime();
      const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));

      if (diffMonths <= 0) {
        return; // Data final já passou ou é igual à data inicial
      }

      totalInstallments = diffMonths;
    }

    // Gerar parcelas aplicando o intervalo
    for (let i = 1; i <= totalInstallments; i++) {
      // Multiplica pelo intervalo para pular os períodos corretos
      const nextDueDate = this.addPeriods(dueDate, data.recurrencePattern!, i * interval);

      // Parar se ultrapassar a data final (quando definida)
      if (data.recurrenceEndDate && nextDueDate > data.recurrenceEndDate) {
        break;
      }

      installments.push({
        account_id: data.accountId,
        category_id: data.categoryId,
        type: 'fixed_expense',
        amount: data.amount,
        description: data.description,
        due_date: nextDueDate,
        status: 'pending',
        is_recurring: true,
        recurrence_pattern: data.recurrencePattern,
        recurrence_interval: data.recurrenceInterval ?? undefined,
        recurrence_count: data.recurrenceCount ?? undefined,
        recurrence_end_date: data.recurrenceEndDate ?? undefined,
        indefinite: data.indefinite ?? false,
        parent_transaction_id: data.parentTransactionId,
      });
    }

    if (installments.length > 0) {
      await tx.transaction.createMany({
        data: installments,
      });
    }
  }

  /**
   * Adiciona períodos a uma data conforme o pattern de recorrência
   */
  private addPeriods(baseDate: Date, pattern: string, periods: number): Date {
    const result = new Date(baseDate);

    switch (pattern) {
      case 'monthly':
        result.setMonth(result.getMonth() + periods);
        break;
      case 'weekly':
        result.setDate(result.getDate() + periods * 7);
        break;
      case 'yearly':
        result.setFullYear(result.getFullYear() + periods);
        break;
    }

    return result;
  }

  /**
   * Cria despesa variável com débito imediato
   */
  async createVariableExpense(userId: string, data: CreateVariableExpenseDTO) {
    // Validações
    if (data.amount <= 0) {
      throw new ValidationError('O valor deve ser positivo');
    }

    const dueDate = data.dueDate ?? new Date();

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar conta
      const account = await tx.account.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new NotFoundError('Conta não encontrada');
      }

      // Verificar acesso (owner ou membro convidado)
      const access = await accountMemberService.checkAccess(data.accountId, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Acesso negado a esta conta');
      }

      // 2. Verificar saldo disponível
      if (Number(account.available_balance) < data.amount) {
        throw new InsufficientBalanceError(
          `Saldo insuficiente. Disponível: R$ ${account.available_balance}, Necessário: R$ ${data.amount}`
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
          due_date: dueDate,
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
      this.invalidateCalendarCache(data.accountId);

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
  async list(
    userId: string,
    filters: {
      accountId?: string;
      types?: string[];
      statuses?: string[];
      startDate?: Date;
      endDate?: Date;
      categoryIds?: string[];
      page?: number;
      limit?: number;
    }
  ) {
    // Tentar buscar do cache se accountId estiver presente
    let cacheKey = '';
    if (filters.accountId) {
      // Remover propriedades undefined para criar hash consistente
      const cleanFilters = JSON.parse(JSON.stringify(filters));
      cacheKey = `calendar:${filters.accountId}:${JSON.stringify(cleanFilters)}`;

      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached, (key, value) => {
          // Reviver datas
          if (['due_date', 'executed_date', 'created_at', 'updated_at'].includes(key) && value) {
            return new Date(value);
          }
          return value;
        });
        return parsed;
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Construir where clause
    const where: Prisma.TransactionWhereInput = {};

    // Se accountId fornecido, verificar acesso
    if (filters.accountId) {
      const account = await prisma.account.findUnique({
        where: { id: filters.accountId },
      });

      if (!account) {
        throw new NotFoundError('Conta não encontrada');
      }

      // Verificar acesso (owner ou membro convidado)
      const access = await accountMemberService.checkAccess(filters.accountId, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Acesso negado a esta conta');
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
        in: userAccounts.map((a) => a.id),
      };
    }

    if (filters.types && filters.types.length > 0) {
      where.type = { in: filters.types };
    }

    if (filters.categoryIds && filters.categoryIds.length > 0) {
      where.category_id = { in: filters.categoryIds };
    }

    if (filters.statuses && filters.statuses.length > 0) {
      const statusConditions: Prisma.TransactionWhereInput[] = [];
      const now = new Date();

      if (filters.statuses.includes('paid')) {
        statusConditions.push({ status: 'executed' });
      }

      if (filters.statuses.includes('pending')) {
        statusConditions.push({
          status: 'pending',
          due_date: { gte: now },
        });
      }

      if (filters.statuses.includes('overdue')) {
        statusConditions.push({
          status: 'pending',
          due_date: { lt: now },
        });
      }

      // Outros status diretos (cancelled, locked)
      const otherStatuses = filters.statuses.filter(
        (s) => !['paid', 'pending', 'overdue'].includes(s)
      );
      if (otherStatuses.length > 0) {
        statusConditions.push({ status: { in: otherStatuses } });
      }

      if (statusConditions.length > 0) {
        where.OR = statusConditions;
      }
    }

    if (filters.startDate || filters.endDate) {
      const dueDateFilter: Prisma.DateTimeFilter = {};
      if (where.due_date && typeof where.due_date === 'object' && !Array.isArray(where.due_date)) {
        Object.assign(dueDateFilter, where.due_date as Prisma.DateTimeFilter);
      }

      if (filters.startDate) {
        dueDateFilter.gte = filters.startDate;
      }
      if (filters.endDate) {
        dueDateFilter.lte = filters.endDate;
      }

      where.due_date = dueDateFilter;
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
        orderBy: [{ due_date: 'desc' }, { created_at: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const result = {
      transactions,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: limit,
      },
    };

    // Salvar no cache se cacheKey existe (apenas para consultas por conta)
    if (cacheKey) {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 300); // 5 minutos
    }

    return result;
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
      throw new NotFoundError('Transação não encontrada');
    }

    // Verificar acesso (owner ou membro convidado)
    const access = await accountMemberService.checkAccess(transaction.account_id, userId);
    if (!access.hasAccess) {
      throw new ForbiddenError('Acesso negado a esta transação');
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
      this.invalidateCalendarCache(transaction.account_id);

      return {
        transaction: updatedTransaction,
        message: 'Transação atualizada com sucesso',
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
      throw new ValidationError('Não é possível duplicar transação sem categoria');
    }

    const duplicateData = {
      accountId: transaction.account_id,
      categoryId: transaction.category_id,
      amount: Number(transaction.amount),
      description: `${transaction.description} (cópia)`,
      dueDate: new Date(),
      isRecurring: transaction.is_recurring,
      recurrencePattern:
        (transaction.recurrence_pattern as 'monthly' | 'weekly' | 'yearly' | undefined) ??
        undefined,
    };

    // Criar nova transação baseada no tipo original
    if (transaction.type === 'income') {
      return this.processIncome(userId, duplicateData);
    } else if (transaction.type === 'fixed_expense') {
      return this.createFixedExpense(userId, { ...duplicateData, type: 'fixed' });
    } else if (transaction.type === 'variable_expense') {
      return this.createVariableExpense(userId, {
        ...duplicateData,
        type: 'variable',
      });
    }

    throw new ValidationError('Tipo de transação inválido');
  }

  /**
   * Realiza transferência entre contas
   */
  async transfer(
    userId: string,
    data: {
      sourceAccountId: string;
      destinationAccountId: string;
      amount: number;
      description?: string;
    }
  ) {
    const { sourceAccountId, destinationAccountId, amount, description } = data;

    // Validações iniciais
    if (amount <= 0) {
      throw new ValidationError('O valor deve ser positivo');
    }

    if (sourceAccountId === destinationAccountId) {
      throw new ValidationError('As contas de origem e destino devem ser diferentes');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar e validar conta origem (com lock)
      const sourceAccount = await tx.account.findUnique({
        where: { id: sourceAccountId },
      });

      if (!sourceAccount) {
        throw new NotFoundError('Conta de origem não encontrada');
      }

      // 2. Verificar se usuário é owner da conta origem
      const access = await accountMemberService.checkAccess(sourceAccountId, userId);
      if (!access.hasAccess || access.role !== 'owner') {
        throw new ForbiddenError('Você deve ser o proprietário da conta de origem para transferir');
      }

      // 3. Verificar saldo disponível
      const availableBalance = Number(sourceAccount.available_balance);
      if (availableBalance < amount) {
        throw new InsufficientBalanceError(
          `Saldo insuficiente. Disponível: R$ ${sourceAccount.available_balance}, Necessário: R$ ${amount}`
        );
      }

      // 4. Buscar e validar conta destino
      const destinationAccount = await tx.account.findUnique({
        where: { id: destinationAccountId },
      });

      if (!destinationAccount) {
        throw new NotFoundError('Conta de destino não encontrada');
      }

      // 5. Buscar categoria de transferências do sistema
      const transferCategory = await tx.category.findFirst({
        where: { is_system: true, type: 'transfer' },
      });

      if (!transferCategory) {
        throw new NotFoundError('Categoria de transferência não encontrada');
      }

      // 6. Debitar da conta origem
      await tx.account.update({
        where: { id: sourceAccountId },
        data: {
          total_balance: { decrement: amount },
          available_balance: { decrement: amount },
          updated_at: new Date(),
        },
      });

      // 7. Criar transação de débito na conta origem
      const debitTransaction = await tx.transaction.create({
        data: {
          account_id: sourceAccountId,
          category_id: transferCategory.id,
          type: 'transfer',
          amount,
          description: description || `Transferência para conta ${destinationAccount.id}`,
          due_date: new Date(),
          executed_date: new Date(),
          status: 'executed',
          destination_account_id: destinationAccountId,
        },
      });

      // 8. Criar BalanceHistory para conta origem
      const updatedSourceAccount = await tx.account.findUnique({
        where: { id: sourceAccountId },
      });

      if (!updatedSourceAccount) {
        throw new NotFoundError('Conta de origem não encontrada após atualização');
      }

      await tx.balanceHistory.create({
        data: {
          account_id: sourceAccountId,
          transaction_id: debitTransaction.id,
          total_balance: updatedSourceAccount.total_balance,
          available_balance: updatedSourceAccount.available_balance,
          locked_balance: updatedSourceAccount.locked_balance,
          emergency_reserve: updatedSourceAccount.emergency_reserve,
          change_reason: 'transfer_sent',
        },
      });

      // 9. Creditar na conta destino
      await tx.account.update({
        where: { id: destinationAccountId },
        data: {
          total_balance: { increment: amount },
          available_balance: { increment: amount },
          updated_at: new Date(),
        },
      });

      // 10. Criar transação de crédito na conta destino
      const creditTransaction = await tx.transaction.create({
        data: {
          account_id: destinationAccountId,
          category_id: transferCategory.id,
          type: 'transfer',
          amount,
          description: description || `Transferência recebida de conta ${sourceAccount.id}`,
          due_date: new Date(),
          executed_date: new Date(),
          status: 'executed',
          source_account_id: sourceAccountId,
        },
      });

      // 11. Criar BalanceHistory para conta destino
      const updatedDestinationAccount = await tx.account.findUnique({
        where: { id: destinationAccountId },
      });

      if (!updatedDestinationAccount) {
        throw new NotFoundError('Conta de destino não encontrada após atualização');
      }

      await tx.balanceHistory.create({
        data: {
          account_id: destinationAccountId,
          transaction_id: creditTransaction.id,
          total_balance: updatedDestinationAccount.total_balance,
          available_balance: updatedDestinationAccount.available_balance,
          locked_balance: updatedDestinationAccount.locked_balance,
          emergency_reserve: updatedDestinationAccount.emergency_reserve,
          change_reason: 'transfer_received',
        },
      });

      // 12. Criar notificações
      await tx.notification.create({
        data: {
          user_id: sourceAccount.user_id,
          notification_type: 'transfer_sent',
          title: 'Transferência realizada',
          message: `Você transferiu R$ ${amount.toFixed(2)} para a conta ${destinationAccount.account_name}`,
          related_transaction_id: debitTransaction.id,
        },
      });

      await tx.notification.create({
        data: {
          user_id: destinationAccount.user_id,
          notification_type: 'transfer_received',
          title: 'Transferência recebida',
          message: `Você recebeu R$ ${amount.toFixed(2)} da conta ${sourceAccount.account_name}`,
          related_transaction_id: creditTransaction.id,
        },
      });

      // 13. Criar evento de auditoria
      await tx.auditEvent.create({
        data: {
          user_id: userId,
          account_id: sourceAccountId,
          event_type: 'transfer_created',
          payload: {
            sourceAccountId,
            destinationAccountId,
            amount,
            description,
            debitTransactionId: debitTransaction.id,
            creditTransactionId: creditTransaction.id,
          },
        },
      });

      // 14. Invalidar cache de calendário
      this.invalidateCalendarCache(sourceAccountId);
      this.invalidateCalendarCache(destinationAccountId);

      // 15. Retornar resultado
      return {
        transfer: {
          id: debitTransaction.id,
          amount,
          description: description || null,
          sourceAccount: {
            id: sourceAccount.id,
            account_name: sourceAccount.account_name,
          },
          destinationAccount: {
            id: destinationAccount.id,
            account_name: destinationAccount.account_name,
          },
          createdAt: debitTransaction.created_at,
        },
        debitTransaction,
        creditTransaction,
      };
    });
  }

  /**
   * Marca uma despesa fixa como paga (executa o pagamento)
   */
  async markFixedExpenseAsPaid(userId: string, transactionId: string) {
    const transaction = await this.getById(userId, transactionId);

    // Só permite marcar como paga se for despesa fixa e estiver bloqueada
    if (transaction.type !== 'fixed_expense') {
      throw new ValidationError('Apenas despesas fixas podem ser marcadas como pagas');
    }

    if (transaction.status !== 'locked') {
      throw new ValidationError('A transação não está bloqueada');
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

      if (!updatedAccount) {
        throw new NotFoundError('Conta não encontrada');
      }

      // Criar snapshot de histórico
      await tx.balanceHistory.create({
        data: {
          account_id: transaction.account_id,
          transaction_id: transactionId,
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
          change_reason: 'fixed_expense_paid',
        },
      });

      // Invalidar cache de sugestões
      await SuggestionEngine.invalidateCache(transaction.account_id);
      this.invalidateCalendarCache(transaction.account_id);

      return {
        transaction: updatedTransaction,
        message: 'Despesa fixa marcada como paga com sucesso',
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
      this.invalidateCalendarCache(transaction.account_id);

      return { message: 'Transação excluída com sucesso' };
    });
  }

  /**
   * Marca uma receita agendada como recebida e atualiza o saldo (regra 30/70)
   */
  async markIncomeAsReceived(userId: string, transactionId: string) {
    const transaction = await this.getById(userId, transactionId);

    if (transaction.type !== 'income') {
      throw new ValidationError('A transação não é uma receita');
    }
    if (transaction.status !== 'pending') {
      throw new ValidationError('Apenas receitas pendentes podem ser marcadas como recebidas');
    }

    return await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { id: transaction.account_id } });
      if (!account) {
        throw new NotFoundError('Conta não encontrada');
      }

      const rules = await tx.financialRule.findMany({
        where: { account_id: transaction.account_id, is_active: true },
        orderBy: { priority: 'asc' },
      });

      const emergencyRule = rules.find((r) => r.rule_type === 'emergency_reserve');
      const reservePercentage = emergencyRule?.percentage ? Number(emergencyRule.percentage) : 30;

      const amount = Number(transaction.amount);
      const reserveAmount = amount * (reservePercentage / 100);
      const availableAmount = amount - reserveAmount;

      const updatedAccount = await tx.account.update({
        where: { id: transaction.account_id },
        data: {
          total_balance: { increment: amount },
          emergency_reserve: { increment: reserveAmount },
          available_balance: { increment: availableAmount },
          updated_at: new Date(),
        },
      });

      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: 'executed', executed_date: new Date() },
      });

      await tx.balanceHistory.create({
        data: {
          account_id: transaction.account_id,
          transaction_id: transaction.id,
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
          change_reason: 'income_received',
        },
      });

      await SuggestionEngine.invalidateCache(transaction.account_id);
      this.invalidateCalendarCache(transaction.account_id);

      return {
        transaction: updatedTransaction,
        breakdown: {
          total_received: amount,
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
}
