import { withAuth } from '../middlewares/withAuth';
import { TransactionService } from '../services/TransactionService';
import {
  createIncomeSchema,
  createExpenseSchema,
  createFixedExpenseSchema,
  createVariableExpenseSchema,
  listFiltersSchema,
  updateTransactionSchema,
} from '../validators/transactionSchemas';

const transactionService = new TransactionService();

export class TransactionController {
  /**
   * POST /api/v1/transactions/income
   * Processa uma receita aplicando regras automáticas
   */
  createIncome = withAuth(async (req, res): Promise<void> => {
    const data = createIncomeSchema.parse(req.body);
    const result = await transactionService.processIncome(req.user.userId, data);

    res.status(201).json(result);
  });

  /**
   * POST /api/v1/transactions/expense
   * Cria uma despesa (fixa ou variável)
   */
  createExpense = withAuth(async (req, res): Promise<void> => {
    const data = createExpenseSchema.parse(req.body);

    if (data.type === 'fixed') {
      const result = await transactionService.createFixedExpense(req.user.userId, data);
      res.status(201).json(result);
    } else {
      const result = await transactionService.createVariableExpense(req.user.userId, data);
      res.status(201).json(result);
    }
  });

  /**
   * POST /api/v1/transactions/expense/fixed
   * Cria uma despesa fixa
   */
  createFixedExpense = withAuth(async (req, res): Promise<void> => {
    const data = createFixedExpenseSchema.parse(req.body);
    const result = await transactionService.createFixedExpense(req.user.userId, data);

    res.status(201).json(result);
  });

  /**
   * POST /api/v1/transactions/expense/variable
   * Cria uma despesa variável
   */
  createVariableExpense = withAuth(async (req, res): Promise<void> => {
    const data = createVariableExpenseSchema.parse(req.body);
    const result = await transactionService.createVariableExpense(req.user.userId, data);

    res.status(201).json(result);
  });

  /**
   * GET /api/v1/transactions
   * Lista transações com filtros
   */
  list = withAuth(async (req, res): Promise<void> => {
    const { type, types, status, statuses, categoryId, categories, ...otherFilters } =
      listFiltersSchema.parse(req.query);

    // Merge singular and plural filters
    const finalTypes = types || (type ? [type] : undefined);
    const finalStatuses = statuses || (status ? [status] : undefined);
    const finalCategories = categories || (categoryId ? [categoryId] : undefined);

    const result = await transactionService.list(req.user.userId, {
      ...otherFilters,
      types: finalTypes,
      statuses: finalStatuses,
      categoryIds: finalCategories,
    });

    res.json(result);
  });

  /**
   * GET /api/v1/transactions/:id
   * Busca transação por ID
   */
  getById = withAuth(async (req, res): Promise<void> => {
    const { id } = req.params;
    const transaction = await transactionService.getById(req.user.userId, id);

    res.json(transaction);
  });

  /**
   * PUT /api/v1/transactions/:id
   * Atualiza uma transação (apenas se pending ou locked)
   */
  update = withAuth(async (req, res): Promise<void> => {
    const { id } = req.params;
    const data = updateTransactionSchema.parse(req.body);
    const result = await transactionService.update(req.user.userId, id, data);

    res.json(result);
  });

  /**
   * POST /api/v1/transactions/:id/mark-as-paid
   * Marca uma despesa fixa como paga
   */
  markAsPaid = withAuth(async (req, res): Promise<void> => {
    const { id } = req.params;
    const result = await transactionService.markFixedExpenseAsPaid(req.user.userId, id);

    res.json(result);
  });

  /**
   * POST /api/v1/transactions/:id/duplicate
   * Duplica uma transação
   */
  duplicate = withAuth(async (req, res): Promise<void> => {
    const { id } = req.params;
    const result = await transactionService.duplicate(req.user.userId, id);

    res.status(201).json(result);
  });

  /**
   * DELETE /api/v1/transactions/:id
   * Deleta uma transação (apenas se pending ou locked)
   */
  delete = withAuth(async (req, res): Promise<void> => {
    const { id } = req.params;
    const result = await transactionService.delete(req.user.userId, id);

    res.json(result);
  });
}
