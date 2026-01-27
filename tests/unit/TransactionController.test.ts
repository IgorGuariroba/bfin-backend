import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionController } from '../../src/controllers/TransactionController';
import { TransactionService } from '../../src/services/TransactionService';
import type { AuthRequest } from '../../src/types';

vi.mock('../../src/services/TransactionService');

describe('TransactionController Unit Tests', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';
  const categoryId = '33333333-3333-3333-3333-333333333333';
  const transactionId = '44444444-4444-4444-4444-444444444444';

  let controller: TransactionController;
  let req: Partial<AuthRequest>;
  let res: Response;
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;
  let mockService: ReturnType<typeof vi.mocked<typeof TransactionService>>['prototype'];

  const buildResponse = (): Response => {
    json = vi.fn();
    status = vi.fn().mockReturnValue({ json });
    return { status, json } as unknown as Response;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    controller = new TransactionController();
    mockService = vi.mocked(TransactionService).prototype;

    req = {
      params: { id: transactionId },
      query: {},
      body: {},
      user: { userId, email: 'user@example.com' },
    } as unknown as AuthRequest;
    res = buildResponse();
  });

  describe('authorization checks', () => {
    it('createIncome should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.createIncome(req as AuthRequest, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('createFixedExpense should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.createFixedExpense(req as AuthRequest, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('createVariableExpense should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.createVariableExpense(req as AuthRequest, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('list should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.list(req as AuthRequest, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('getById should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.getById(req as AuthRequest, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('update should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.update(req as AuthRequest, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('markAsPaid should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.markAsPaid(req as AuthRequest, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('duplicate should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.duplicate(req as AuthRequest, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('delete should return 401 when unauthenticated', async () => {
      req.user = undefined;

      await controller.delete(req as AuthRequest, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('happy paths', () => {
    it('createIncome should parse data, call service, and return 201', async () => {
      const dueDateIso = '2026-02-10T12:00:00.000Z';
      req.body = {
        accountId,
        amount: 1500,
        description: 'Salary',
        categoryId,
        dueDate: dueDateIso,
        isRecurring: true,
        recurrencePattern: 'monthly',
      };

      const serviceResult = { ok: true };
      mockService.processIncome.mockResolvedValue(serviceResult);

      await controller.createIncome(req as AuthRequest, res);

      expect(mockService.processIncome).toHaveBeenCalledTimes(1);
      const [, parsed] = mockService.processIncome.mock.calls[0];
      expect(parsed).toMatchObject({
        accountId,
        amount: 1500,
        description: 'Salary',
        categoryId,
        isRecurring: true,
        recurrencePattern: 'monthly',
      });
      expect(parsed.dueDate).toBeInstanceOf(Date);
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(serviceResult);
    });

    it('createFixedExpense should transform dueDate, call service, and return 201', async () => {
      const dueDateIso = '2026-03-01T00:00:00.000Z';
      req.body = {
        accountId,
        amount: 200,
        description: 'Rent',
        categoryId,
        dueDate: dueDateIso,
        isRecurring: true,
        recurrencePattern: 'monthly',
      };

      const serviceResult = { ok: true };
      mockService.createFixedExpense.mockResolvedValue(serviceResult);

      await controller.createFixedExpense(req as AuthRequest, res);

      expect(mockService.createFixedExpense).toHaveBeenCalledTimes(1);
      const [, parsed] = mockService.createFixedExpense.mock.calls[0];
      expect(parsed).toMatchObject({
        accountId,
        amount: 200,
        description: 'Rent',
        categoryId,
        isRecurring: true,
        recurrencePattern: 'monthly',
      });
      expect(parsed.dueDate).toBeInstanceOf(Date);
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(serviceResult);
    });

    it('createVariableExpense should validate, call service, and return 201', async () => {
      req.body = {
        accountId,
        amount: 50,
        description: 'Groceries',
        categoryId,
      };

      const serviceResult = { ok: true };
      mockService.createVariableExpense.mockResolvedValue(serviceResult);

      await controller.createVariableExpense(req as AuthRequest, res);

      expect(mockService.createVariableExpense).toHaveBeenCalledWith(userId, {
        accountId,
        amount: 50,
        description: 'Groceries',
        categoryId,
      });
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(serviceResult);
    });

    it('list should merge singular filters, parse values, and return json', async () => {
      const startIso = '2026-01-01T00:00:00.000Z';
      const endIso = '2026-01-31T23:59:59.000Z';
      req.query = {
        accountId,
        type: 'income',
        status: 'executed',
        categoryId,
        startDate: startIso,
        endDate: endIso,
        page: '2',
        limit: '25',
      };

      const serviceResult = { data: [], meta: { page: 2, limit: 25, total: 0 } };
      mockService.list.mockResolvedValue(serviceResult);

      await controller.list(req as AuthRequest, res);

      expect(mockService.list).toHaveBeenCalledTimes(1);
      const [, filters] = mockService.list.mock.calls[0];
      expect(filters).toMatchObject({
        accountId,
        page: 2,
        limit: 25,
        types: ['income'],
        statuses: ['executed'],
        categoryIds: [categoryId],
      });
      expect(filters.startDate).toBeInstanceOf(Date);
      expect(filters.endDate).toBeInstanceOf(Date);
      expect(json).toHaveBeenCalledWith(serviceResult);
    });

    it('list should prefer plural filters over singular filters', async () => {
      const otherCategoryId = '55555555-5555-5555-5555-555555555555';
      req.query = {
        type: 'income',
        types: 'fixed_expense,variable_expense',
        status: 'executed',
        statuses: 'pending,locked',
        categoryId,
        categories: `${categoryId},${otherCategoryId}`,
      };

      const serviceResult = { data: [], meta: { page: 1, limit: 50, total: 0 } };
      mockService.list.mockResolvedValue(serviceResult);

      await controller.list(req as AuthRequest, res);

      const [, filters] = mockService.list.mock.calls[0];
      expect(filters.types).toEqual(['fixed_expense', 'variable_expense']);
      expect(filters.statuses).toEqual(['pending', 'locked']);
      expect(filters.categoryIds).toEqual([categoryId, otherCategoryId]);
      expect(json).toHaveBeenCalledWith(serviceResult);
    });

    it('getById should call service and return json', async () => {
      const transaction = { id: transactionId };
      mockService.getById.mockResolvedValue(transaction);

      await controller.getById(req as AuthRequest, res);

      expect(mockService.getById).toHaveBeenCalledWith(userId, transactionId);
      expect(json).toHaveBeenCalledWith(transaction);
    });

    it('update should parse data, call service, and return json', async () => {
      const dueDateIso = '2026-04-15T08:30:00.000Z';
      req.body = {
        amount: 75,
        description: 'Updated',
        categoryId,
        dueDate: dueDateIso,
      };
      const updated = { id: transactionId };
      mockService.update.mockResolvedValue(updated);

      await controller.update(req as AuthRequest, res);

      expect(mockService.update).toHaveBeenCalledTimes(1);
      const [, , parsed] = mockService.update.mock.calls[0];
      expect(parsed).toMatchObject({
        amount: 75,
        description: 'Updated',
        categoryId,
      });
      expect(parsed.dueDate).toBeInstanceOf(Date);
      expect(json).toHaveBeenCalledWith(updated);
    });

    it('markAsPaid should call service and return json', async () => {
      const result = { success: true };
      mockService.markFixedExpenseAsPaid.mockResolvedValue(result);

      await controller.markAsPaid(req as AuthRequest, res);

      expect(mockService.markFixedExpenseAsPaid).toHaveBeenCalledWith(userId, transactionId);
      expect(json).toHaveBeenCalledWith(result);
    });

    it('duplicate should call service and return 201', async () => {
      const result = { id: '66666666-6666-6666-6666-666666666666' };
      mockService.duplicate.mockResolvedValue(result);

      await controller.duplicate(req as AuthRequest, res);

      expect(mockService.duplicate).toHaveBeenCalledWith(userId, transactionId);
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(result);
    });

    it('delete should call service and return json', async () => {
      const result = { success: true };
      mockService.delete.mockResolvedValue(result);

      await controller.delete(req as AuthRequest, res);

      expect(mockService.delete).toHaveBeenCalledWith(userId, transactionId);
      expect(json).toHaveBeenCalledWith(result);
    });
  });
});
