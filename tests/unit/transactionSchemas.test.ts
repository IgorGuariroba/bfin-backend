import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  transactionBaseSchema,
  recurrenceSchema,
  listFiltersSchema,
  updateTransactionSchema,
  createIncomeSchema,
  createFixedExpenseSchema,
  createVariableExpenseSchema,
  createExpenseSchema,
} from '../../src/validators/transactionSchemas';

describe('transactionSchemas', () => {
  describe('transactionBaseSchema', () => {
    it('should validate valid transaction base data', () => {
      const data = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100.5,
        description: 'Test transaction',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
      };

      const result = transactionBaseSchema.parse(data);

      expect(result).toEqual({
        ...data,
        dueDate: undefined,
      });
    });

    it('should transform dueDate string to Date', () => {
      const data = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100.5,
        description: 'Test transaction',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        dueDate: '2024-01-15T10:00:00Z',
      };

      const result = transactionBaseSchema.parse(data);

      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.dueDate?.toISOString()).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should fail with invalid UUID', () => {
      const data = {
        accountId: 'invalid-uuid',
        amount: 100.5,
        description: 'Test transaction',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(() => transactionBaseSchema.parse(data)).toThrow(z.ZodError);
    });

    it('should fail with negative amount', () => {
      const data = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: -100,
        description: 'Test transaction',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(() => transactionBaseSchema.parse(data)).toThrow(z.ZodError);
    });
  });

  describe('recurrenceSchema', () => {
    it('should validate valid recurrence data', () => {
      const data = {
        isRecurring: true,
        recurrencePattern: 'monthly' as const,
        recurrenceInterval: 1,
        recurrenceCount: 12,
        indefinite: false,
      };

      const result = recurrenceSchema.parse(data);

      expect(result).toEqual({
        ...data,
        recurrenceEndDate: null,
      });
    });

    it('should transform recurrenceEndDate string to Date', () => {
      const data = {
        isRecurring: true,
        recurrencePattern: 'monthly' as const,
        recurrenceEndDate: '2024-12-31T23:59:59Z',
      };

      const result = recurrenceSchema.parse(data);

      expect(result.recurrenceEndDate).toBeInstanceOf(Date);
      expect(result.recurrenceEndDate?.toISOString()).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should accept null recurrenceEndDate', () => {
      const data = {
        isRecurring: true,
        recurrenceEndDate: null,
      };

      const result = recurrenceSchema.parse(data);

      expect(result.recurrenceEndDate).toBeNull();
    });
  });

  describe('listFiltersSchema', () => {
    it('should validate empty filters', () => {
      const data = {};

      const result = listFiltersSchema.parse(data);

      expect(result).toEqual({
        page: 1,
        limit: 50,
      });
    });

    it('should transform page and limit from strings to numbers', () => {
      const data = {
        page: '2',
        limit: '25',
      };

      const result = listFiltersSchema.parse(data);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
    });

    it('should use default values for page and limit', () => {
      const data = {};

      const result = listFiltersSchema.parse(data);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('should transform comma-separated string to array for types', () => {
      const data = {
        types: 'income,fixed_expense',
      };

      const result = listFiltersSchema.parse(data);

      expect(result.types).toEqual(['income', 'fixed_expense']);
    });

    it('should keep array as is for types', () => {
      const data = {
        types: ['income', 'variable_expense'],
      };

      const result = listFiltersSchema.parse(data);

      expect(result.types).toEqual(['income', 'variable_expense']);
    });

    it('should transform comma-separated string to array for statuses', () => {
      const data = {
        statuses: 'pending,executed',
      };

      const result = listFiltersSchema.parse(data);

      expect(result.statuses).toEqual(['pending', 'executed']);
    });

    it('should transform comma-separated string to array for categories', () => {
      const data = {
        categories: 'cat1,cat2,cat3',
      };

      const result = listFiltersSchema.parse(data);

      expect(result.categories).toEqual(['cat1', 'cat2', 'cat3']);
    });

    it('should transform startDate and endDate to Date objects', () => {
      const data = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
      };

      const result = listFiltersSchema.parse(data);

      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });
  });

  describe('updateTransactionSchema', () => {
    it('should validate valid update data', () => {
      const data = {
        amount: 200,
        description: 'Updated description',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
      };

      const result = updateTransactionSchema.parse(data);

      expect(result).toEqual({
        ...data,
        dueDate: undefined,
      });
    });

    it('should accept partial data', () => {
      const data = {
        amount: 200,
      };

      const result = updateTransactionSchema.parse(data);

      expect(result).toEqual({
        amount: 200,
      });
    });

    it('should transform dueDate to Date', () => {
      const data = {
        dueDate: '2024-06-15T12:00:00Z',
      };

      const result = updateTransactionSchema.parse(data);

      expect(result.dueDate).toBeInstanceOf(Date);
    });
  });

  describe('createIncomeSchema', () => {
    it('should validate valid income data', () => {
      const data = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 1000,
        description: 'Salary',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        isRecurring: true,
        recurrencePattern: 'monthly',
      };

      const result = createIncomeSchema.parse(data);

      expect(result).toEqual({
        ...data,
        dueDate: undefined,
      });
    });
  });

  describe('createFixedExpenseSchema', () => {
    it('should validate valid fixed expense data', () => {
      const data = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 500,
        description: 'Rent',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'fixed' as const,
        isRecurring: true,
        recurrencePattern: 'monthly',
        indefinite: true,
      };

      const result = createFixedExpenseSchema.parse(data);

      expect(result.type).toBe('fixed');
      expect(result.indefinite).toBe(true);
    });
  });

  describe('createVariableExpenseSchema', () => {
    it('should validate valid variable expense data', () => {
      const data = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 150,
        description: 'Groceries',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'variable' as const,
      };

      const result = createVariableExpenseSchema.parse(data);

      expect(result.type).toBe('variable');
    });
  });

  describe('createExpenseSchema', () => {
    it('should validate fixed expense with discriminated union', () => {
      const data = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 500,
        description: 'Rent',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'fixed' as const,
      };

      const result = createExpenseSchema.parse(data);

      expect(result.type).toBe('fixed');
    });

    it('should validate variable expense with discriminated union', () => {
      const data = {
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 150,
        description: 'Groceries',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'variable' as const,
      };

      const result = createExpenseSchema.parse(data);

      expect(result.type).toBe('variable');
    });
  });
});
