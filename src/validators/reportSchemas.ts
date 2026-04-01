import { z } from 'zod';

export const monthlySummarySchema = z.object({
  month: z
    .string({ required_error: 'month é obrigatório' })
    .transform((v) => Number.parseInt(v, 10))
    .refine((v) => v >= 1 && v <= 12, 'month deve ser entre 1 e 12'),
  year: z
    .string({ required_error: 'year é obrigatório' })
    .transform((v) => Number.parseInt(v, 10))
    .refine((v) => v >= 2000 && v <= 2100, 'year inválido'),
});

export type MonthlySummaryQuery = z.infer<typeof monthlySummarySchema>;
