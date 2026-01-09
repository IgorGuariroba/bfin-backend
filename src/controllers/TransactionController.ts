import { Response } from 'express';
import { TransactionService } from '../services/TransactionService';
import { AuthRequest } from '../types';
import { z } from 'zod';

const transactionService = new TransactionService();

// Schemas de validação
const createIncomeSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().uuid('Invalid category ID'),
  dueDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['monthly', 'weekly', 'yearly']).optional(),
});

const createFixedExpenseSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().uuid('Invalid category ID'),
  dueDate: z.string().datetime('Due date is required').transform(val => new Date(val)),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['monthly', 'weekly', 'yearly']).optional(),
});

const createVariableExpenseSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().uuid('Invalid category ID'),
});

const listTransactionsSchema = z.object({
  accountId: z.string().uuid().optional(),
  type: z.enum(['income', 'fixed_expense', 'variable_expense']).optional(),
  status: z.enum(['pending', 'executed', 'cancelled', 'locked']).optional(),
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  categoryId: z.string().uuid().optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

const updateTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  description: z.string().min(1, 'Description is required').optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  dueDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});

export class TransactionController {
  /**
   * POST /api/v1/transactions/income
   * Processa uma receita aplicando regras automáticas
   */
  async createIncome(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const data = createIncomeSchema.parse(req.body);
    const result = await transactionService.processIncome(req.user.userId, data);

    res.status(201).json(result);
  }

  /**
   * POST /api/v1/transactions/fixed-expense
   * Cria despesa fixa com bloqueio preventivo
   */
  async createFixedExpense(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const data = createFixedExpenseSchema.parse(req.body);
    const result = await transactionService.createFixedExpense(req.user.userId, data);

    res.status(201).json(result);
  }

  /**
   * POST /api/v1/transactions/variable-expense
   * Cria despesa variável com débito imediato
   */
  async createVariableExpense(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const data = createVariableExpenseSchema.parse(req.body);
    const result = await transactionService.createVariableExpense(req.user.userId, data);

    res.status(201).json(result);
  }

  /**
   * GET /api/v1/transactions
   * Lista transações com filtros
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const filters = listTransactionsSchema.parse(req.query);
    const result = await transactionService.list(req.user.userId, filters);

    res.json(result);
  }

  /**
   * GET /api/v1/transactions/:id
   * Busca transação por ID
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const transaction = await transactionService.getById(req.user.userId, id);

    res.json(transaction);
  }

  /**
   * PUT /api/v1/transactions/:id
   * Atualiza uma transação (apenas se pending ou locked)
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const data = updateTransactionSchema.parse(req.body);
    const result = await transactionService.update(req.user.userId, id, data);

    res.json(result);
  }

  /**
   * POST /api/v1/transactions/:id/mark-as-paid
   * Marca uma despesa fixa como paga
   */
  async markAsPaid(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const result = await transactionService.markFixedExpenseAsPaid(req.user.userId, id);

    res.json(result);
  }

  /**
   * POST /api/v1/transactions/:id/duplicate
   * Duplica uma transação
   */
  async duplicate(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const result = await transactionService.duplicate(req.user.userId, id);

    res.status(201).json(result);
  }

  /**
   * DELETE /api/v1/transactions/:id
   * Deleta uma transação (apenas se pending ou locked)
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const result = await transactionService.delete(req.user.userId, id);

    res.json(result);
  }
}
