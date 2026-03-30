import { z } from 'zod';

export const monthlyProjectionSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  year: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .refine((v) => v >= 2020 && v <= 2100, 'Invalid year'),
  month: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .refine((v) => v >= 1 && v <= 12, 'Month must be between 1 and 12'),
});
