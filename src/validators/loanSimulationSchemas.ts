import { z } from 'zod';
import {
  LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY,
  LOAN_SIMULATION_MAX_TERM_MONTHS,
  LOAN_SIMULATION_MIN_TERM_MONTHS,
} from '../types';

export const createLoanSimulationSchema = z.object({
  amount: z.number({ invalid_type_error: 'amount must be a number' }).min(0.01),
  termMonths: z
    .number({ invalid_type_error: 'termMonths must be a number' })
    .int()
    .min(LOAN_SIMULATION_MIN_TERM_MONTHS)
    .max(LOAN_SIMULATION_MAX_TERM_MONTHS),
  interestRateMonthly: z
    .number({ invalid_type_error: 'interestRateMonthly must be a number' })
    .positive()
    .max(1)
    .optional()
    .default(LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY),
});

export const listLoanSimulationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const getLoanSimulationParamsSchema = z.object({
  simulationId: z.string().min(1),
});

export type CreateLoanSimulationDTO = z.infer<typeof createLoanSimulationSchema>;
export type ListLoanSimulationsQueryDTO = z.infer<typeof listLoanSimulationsQuerySchema>;
export type GetLoanSimulationParamsDTO = z.infer<typeof getLoanSimulationParamsSchema>;
