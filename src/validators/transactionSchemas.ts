import { z } from 'zod';

/**
 * Helpers para transformações comuns
 *
 * Aceita "YYYY-MM-DD" ou ISO 8601 completo (com ou sem Z).
 * Normaliza sempre para UTC midnight — datas financeiras não têm hora.
 * Isso garante que o servidor em qualquer fuso horário trate "2026-03-15"
 * como 2026-03-15T00:00:00Z, independente do local do servidor.
 */
function toUTCMidnight(val: string): Date {
  // "YYYY-MM-DD" → interpreta como UTC midnight diretamente
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(`${val}T00:00:00.000Z`);
  }
  // ISO 8601 completo → zera a hora em UTC para padronizar
  const d = new Date(val);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
const dateSchema = z.string().regex(DATE_REGEX, 'Use o formato YYYY-MM-DD ou ISO 8601');

const dateTransform = (val?: string) => (val ? toUTCMidnight(val) : undefined);
const dateTransformNullable = (val?: string | null) => (val ? toUTCMidnight(val) : null);

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
  accountId: z.string().uuid('ID de conta inválido'),
  amount: z.number().positive('O valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  categoryId: z.string().uuid('ID de categoria inválido'),
  dueDate: dateSchema.optional().transform(dateTransform),
});

/**
 * Schema para campos de recorrência
 */
export const recurrenceSchema = z.object({
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['monthly', 'weekly', 'yearly']).optional(),
  recurrenceInterval: z.number().int().positive().optional().nullable(),
  recurrenceCount: z.number().int().positive().optional().nullable(),
  recurrenceEndDate: dateSchema.optional().nullable().transform(dateTransformNullable),
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
  startDate: dateSchema.optional().transform(dateTransform),
  endDate: dateSchema.optional().transform(dateTransform),
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
  amount: z.number().positive('O valor deve ser positivo').optional(),
  description: z.string().min(1, 'Descrição é obrigatória').optional(),
  categoryId: z.string().uuid('ID de categoria inválido').optional(),
  dueDate: dateSchema.optional().transform(dateTransform),
});

/**
 * Schema para transferência entre contas
 */
export const createTransferSchema = z.object({
  sourceAccountId: z.string().uuid('ID de conta de origem inválido'),
  destinationAccountId: z.string().uuid('ID de conta de destino inválido'),
  amount: z.number().positive('O valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória').max(255).optional(),
});

/**
 * Schemas específicos para transações
 */

// Income
export const createIncomeSchema = transactionBaseSchema.extend({
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['monthly', 'weekly', 'yearly']).optional(),
  recurrenceInterval: z.number().int().positive().optional().nullable(),
  recurrenceCount: z.number().int().positive().optional().nullable(),
  recurrenceEndDate: dateSchema.optional().nullable().transform(dateTransformNullable),
  indefinite: z.boolean().optional(),
});

// Expense base (comum para fixed e variable)
export const expenseBaseSchema = transactionBaseSchema.extend({
  type: z.enum(['fixed', 'variable']),
});

// Fixed expense
export const createFixedExpenseSchema = expenseBaseSchema
  .extend({
    type: z.literal('fixed'),
    isFloating: z.boolean().optional(), // true = dívida sem data de vencimento
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
