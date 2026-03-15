import { z } from 'zod';

/**
 * Helpers para transformações comuns
 */
const dateTransform = (val?: string) => (val ? new Date(val) : undefined);
const dateTransformNullable = (val?: string | null) => (val ? new Date(val) : null);

const arrayTransform = (val?: string | string[]) => {
  if (!val) {
    return undefined;
  }
  return Array.isArray(val) ? val : val.split(',');
};

/**
 * Schema base para transações (campos comuns entre income e expense)
 */
export const transactionBaseSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().uuid('Invalid category ID'),
  dueDate: z.string().datetime().optional().transform(dateTransform),
});

/**
 * Schema para campos de recorrência
 */
export const recurrenceSchema = z.object({
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['monthly', 'weekly', 'yearly']).optional(),
  recurrenceInterval: z.number().int().positive().optional().nullable(),
  recurrenceCount: z.number().int().positive().optional().nullable(),
  recurrenceEndDate: z.string().datetime().optional().nullable().transform(dateTransformNullable),
  indefinite: z.boolean().optional(),
});

/**
 * Schema para filtros de listagem reutilizáveis
 */
export const listFiltersSchema = z.object({
  accountId: z.string().uuid().optional(),
  type: z.enum(['income', 'fixed_expense', 'variable_expense']).optional(),
  types: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(arrayTransform),
  status: z.enum(['pending', 'executed', 'cancelled', 'locked']).optional(),
  statuses: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(arrayTransform),
  startDate: z.string().datetime().optional().transform(dateTransform),
  endDate: z.string().datetime().optional().transform(dateTransform),
  categoryId: z.string().uuid().optional(),
  categories: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(arrayTransform),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : 50)),
});

/**
 * Schema para atualização de transação (campos opcionais)
 */
export const updateTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  description: z.string().min(1, 'Description is required').optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  dueDate: z.string().datetime().optional().transform(dateTransform),
});

/**
 * Schema para transferência entre contas
 */
export const createTransferSchema = z.object({
  sourceAccountId: z.string().uuid('Invalid source account ID'),
  destinationAccountId: z.string().uuid('Invalid destination account ID'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(255).optional(),
});

/**
 * Schemas específicos para transações
 */

// Income
export const createIncomeSchema = transactionBaseSchema.extend({
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['monthly', 'weekly', 'yearly']).optional(),
});

// Expense base (comum para fixed e variable)
export const expenseBaseSchema = transactionBaseSchema.extend({
  type: z.enum(['fixed', 'variable']),
});

// Fixed expense
export const createFixedExpenseSchema = expenseBaseSchema
  .extend({
    type: z.literal('fixed'),
  })
  .merge(recurrenceSchema);

// Variable expense
export const createVariableExpenseSchema = expenseBaseSchema.extend({
  type: z.literal('variable'),
});

// Expense completo (para o endpoint genérico)
export const createExpenseSchema = z.discriminatedUnion('type', [
  createFixedExpenseSchema,
  createVariableExpenseSchema,
]);
