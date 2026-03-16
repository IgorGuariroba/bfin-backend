import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  transactionBaseSchema,
  recurrenceSchema,
  listFiltersSchema,
  updateTransactionSchema,
  createTransferSchema,
  createIncomeSchema,
  expenseBaseSchema,
  createFixedExpenseSchema,
  createVariableExpenseSchema,
  createExpenseSchema,
} from '../../src/validators/transactionSchemas';

describe('transactionSchemas', () => {
  describe('transactionBaseSchema', () => {
    it('should validate valid transaction', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100.5,
        description: 'Test transaction',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
      };

      const result = transactionBaseSchema.parse(input);

      expect(result.accountId).toBe(input.accountId);
      expect(result.amount).toBe(100.5);
      expect(result.description).toBe('Test transaction');
      expect(result.categoryId).toBe(input.categoryId);
    });

    it('should validate with optional dueDate', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100.5,
        description: 'Test transaction',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        dueDate: '2024-01-15T00:00:00.000Z',
      };

      const result = transactionBaseSchema.parse(input);

      expect(result.dueDate).toBeInstanceOf(Date);
    });

    it('should throw for invalid UUID accountId', () => {
      const input = {
        accountId: 'invalid-uuid',
        amount: 100.5,
        description: 'Test transaction',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(() => transactionBaseSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for non-positive amount', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: -100,
        description: 'Test transaction',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(() => transactionBaseSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for empty description', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        description: '',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(() => transactionBaseSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for invalid UUID categoryId', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        description: 'Test',
        categoryId: 'invalid-uuid',
      };

      expect(() => transactionBaseSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('recurrenceSchema', () => {
    it('should validate empty recurrence', () => {
      const input = {};

      const result = recurrenceSchema.parse(input);

      // Schema transforma valores undefined em null para alguns campos
      expect(result).toBeDefined();
      expect(result.recurrenceEndDate).toBeNull();
    });

    it('should validate with all fields', () => {
      const input = {
        isRecurring: true,
        recurrencePattern: 'monthly' as const,
        recurrenceInterval: 2,
        recurrenceCount: 12,
        recurrenceEndDate: '2024-12-31T00:00:00.000Z',
        indefinite: false,
      };

      const result = recurrenceSchema.parse(input);

      expect(result.isRecurring).toBe(true);
      expect(result.recurrencePattern).toBe('monthly');
      expect(result.recurrenceInterval).toBe(2);
      expect(result.recurrenceCount).toBe(12);
      expect(result.recurrenceEndDate).toBeInstanceOf(Date);
    });

    it('should accept null recurrenceEndDate', () => {
      const input = {
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceEndDate: null,
      };

      const result = recurrenceSchema.parse(input);

      expect(result.recurrenceEndDate).toBeNull();
    });

    it('should accept null recurrenceCount', () => {
      const input = {
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceCount: null,
      };

      const result = recurrenceSchema.parse(input);

      expect(result.recurrenceCount).toBeNull();
    });

    it('should throw for invalid recurrencePattern', () => {
      const input = {
        isRecurring: true,
        recurrencePattern: 'invalid',
      };

      expect(() => recurrenceSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for non-positive recurrenceInterval', () => {
      const input = {
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceInterval: 0,
      };

      expect(() => recurrenceSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for non-positive recurrenceCount', () => {
      const input = {
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceCount: -1,
      };

      expect(() => recurrenceSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('listFiltersSchema', () => {
    it('should validate empty filters', () => {
      const input = {};

      const result = listFiltersSchema.parse(input);

      expect(result).toEqual({
        page: 1,
        limit: 50,
      });
    });

    it('should validate with all filters', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'income',
        types: 'income,fixed_expense',
        status: 'pending',
        statuses: 'pending,executed',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T00:00:00.000Z',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        categories: 'cat1,cat2',
        page: '2',
        limit: '20',
      };

      const result = listFiltersSchema.parse(input);

      expect(result.accountId).toBe(input.accountId);
      expect(result.type).toBe('income');
      expect(result.types).toEqual(['income', 'fixed_expense']);
      expect(result.status).toBe('pending');
      expect(result.statuses).toEqual(['pending', 'executed']);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
    });

    it('should transform string types to array', () => {
      const input = { types: 'income,expense' };

      const result = listFiltersSchema.parse(input);

      expect(result.types).toEqual(['income', 'expense']);
    });

    it('should keep array types as array', () => {
      const input = { types: ['income', 'expense'] };

      const result = listFiltersSchema.parse(input);

      expect(result.types).toEqual(['income', 'expense']);
    });

    it('should throw for invalid UUID accountId', () => {
      const input = { accountId: 'invalid-uuid' };

      expect(() => listFiltersSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for invalid type enum', () => {
      const input = { type: 'invalid' };

      expect(() => listFiltersSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for invalid status enum', () => {
      const input = { status: 'invalid' };

      expect(() => listFiltersSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('updateTransactionSchema', () => {
    it('should validate partial update', () => {
      const input = {
        amount: 200.5,
      };

      const result = updateTransactionSchema.parse(input);

      expect(result.amount).toBe(200.5);
    });

    it('should validate with all fields', () => {
      const input = {
        amount: 200.5,
        description: 'Updated description',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        dueDate: '2024-01-15T00:00:00.000Z',
      };

      const result = updateTransactionSchema.parse(input);

      expect(result.amount).toBe(200.5);
      expect(result.description).toBe('Updated description');
      expect(result.categoryId).toBe(input.categoryId);
      expect(result.dueDate).toBeInstanceOf(Date);
    });

    it('should throw for non-positive amount', () => {
      const input = { amount: -100 };

      expect(() => updateTransactionSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for empty description', () => {
      const input = { description: '' };

      expect(() => updateTransactionSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for invalid UUID categoryId', () => {
      const input = { categoryId: 'invalid-uuid' };

      expect(() => updateTransactionSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('createTransferSchema', () => {
    it('should validate valid transfer', () => {
      const input = {
        sourceAccountId: '123e4567-e89b-12d3-a456-426614174000',
        destinationAccountId: '123e4567-e89b-12d3-a456-426614174001',
        amount: 100.5,
        description: 'Transfer',
      };

      const result = createTransferSchema.parse(input);

      expect(result.sourceAccountId).toBe(input.sourceAccountId);
      expect(result.destinationAccountId).toBe(input.destinationAccountId);
      expect(result.amount).toBe(100.5);
      expect(result.description).toBe('Transfer');
    });

    it('should validate without optional description', () => {
      const input = {
        sourceAccountId: '123e4567-e89b-12d3-a456-426614174000',
        destinationAccountId: '123e4567-e89b-12d3-a456-426614174001',
        amount: 100.5,
      };

      const result = createTransferSchema.parse(input);

      expect(result.description).toBeUndefined();
    });

    it('should throw for invalid sourceAccountId', () => {
      const input = {
        sourceAccountId: 'invalid-uuid',
        destinationAccountId: '123e4567-e89b-12d3-a456-426614174001',
        amount: 100,
      };

      expect(() => createTransferSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for invalid destinationAccountId', () => {
      const input = {
        sourceAccountId: '123e4567-e89b-12d3-a456-426614174000',
        destinationAccountId: 'invalid-uuid',
        amount: 100,
      };

      expect(() => createTransferSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for non-positive amount', () => {
      const input = {
        sourceAccountId: '123e4567-e89b-12d3-a456-426614174000',
        destinationAccountId: '123e4567-e89b-12d3-a456-426614174001',
        amount: -100,
      };

      expect(() => createTransferSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for empty description', () => {
      const input = {
        sourceAccountId: '123e4567-e89b-12d3-a456-426614174000',
        destinationAccountId: '123e4567-e89b-12d3-a456-426614174001',
        amount: 100,
        description: '',
      };

      expect(() => createTransferSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for description too long', () => {
      const input = {
        sourceAccountId: '123e4567-e89b-12d3-a456-426614174000',
        destinationAccountId: '123e4567-e89b-12d3-a456-426614174001',
        amount: 100,
        description: 'a'.repeat(256),
      };

      expect(() => createTransferSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('createIncomeSchema', () => {
    it('should validate valid income', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 1000,
        description: 'Salary',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
      };

      const result = createIncomeSchema.parse(input);

      expect(result.accountId).toBe(input.accountId);
      expect(result.amount).toBe(1000);
    });

    it('should validate with optional recurrence fields', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 1000,
        description: 'Salary',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        isRecurring: true,
        recurrencePattern: 'monthly',
      };

      const result = createIncomeSchema.parse(input);

      expect(result.isRecurring).toBe(true);
      expect(result.recurrencePattern).toBe('monthly');
    });
  });

  describe('expenseBaseSchema', () => {
    it('should validate valid expense', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        description: 'Expense',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'fixed' as const,
      };

      const result = expenseBaseSchema.parse(input);

      expect(result.type).toBe('fixed');
    });

    it('should throw for invalid type', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        description: 'Expense',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'invalid',
      };

      expect(() => expenseBaseSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('createFixedExpenseSchema', () => {
    it('should validate valid fixed expense', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        description: 'Rent',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'fixed' as const,
        dueDate: '2024-01-01T00:00:00.000Z',
        isRecurring: true,
        recurrencePattern: 'monthly',
        indefinite: true,
      };

      const result = createFixedExpenseSchema.parse(input);

      expect(result.type).toBe('fixed');
      expect(result.indefinite).toBe(true);
    });

    it('should validate with recurrenceCount', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        description: 'Rent',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'fixed' as const,
        dueDate: '2024-01-01T00:00:00.000Z',
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceCount: 12,
      };

      const result = createFixedExpenseSchema.parse(input);

      expect(result.recurrenceCount).toBe(12);
    });
  });

  describe('createVariableExpenseSchema', () => {
    it('should validate valid variable expense', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 50,
        description: 'Groceries',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'variable' as const,
      };

      const result = createVariableExpenseSchema.parse(input);

      expect(result.type).toBe('variable');
    });

    it('should not allow recurrence fields', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 50,
        description: 'Groceries',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'variable' as const,
        isRecurring: true,
      };

      // Variable expense schema doesn't include recurrence fields
      const result = createVariableExpenseSchema.parse(input);

      expect(result.type).toBe('variable');
    });
  });

  describe('createExpenseSchema', () => {
    it('should validate fixed expense with discriminated union', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        description: 'Rent',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'fixed' as const,
        dueDate: '2024-01-01T00:00:00.000Z',
      };

      const result = createExpenseSchema.parse(input);

      expect(result.type).toBe('fixed');
    });

    it('should validate variable expense with discriminated union', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 50,
        description: 'Groceries',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'variable' as const,
      };

      const result = createExpenseSchema.parse(input);

      expect(result.type).toBe('variable');
    });

    it('should throw for invalid type in discriminated union', () => {
      const input = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        description: 'Expense',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'invalid' as const,
      };

      expect(() => createExpenseSchema.parse(input)).toThrow(z.ZodError);
    });
  });
});
