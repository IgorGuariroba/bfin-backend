import { z } from 'zod';
import {
  LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY,
  LOAN_SIMULATION_MAX_TERM_MONTHS,
  LOAN_SIMULATION_MIN_TERM_MONTHS,
  LoanSimulationStatus,
} from '../types';

export const createLoanSimulationSchema = z.object({
  amount: z.number({ invalid_type_error: 'amount deve ser um número' }).min(0.01),
  termMonths: z
    .number({ invalid_type_error: 'termMonths deve ser um número' })
    .int()
    .min(LOAN_SIMULATION_MIN_TERM_MONTHS)
    .max(LOAN_SIMULATION_MAX_TERM_MONTHS),
  interestRateMonthly: z
    .number({ invalid_type_error: 'interestRateMonthly deve ser um número' })
    .positive()
    .max(1)
    .optional()
    .default(LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY),
});

export const listLoanSimulationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.nativeEnum(LoanSimulationStatus).optional(),
});

export const getLoanSimulationParamsSchema = z.object({
  simulationId: z.string().min(1),
});

// Approval and withdrawal schemas
export const approveSimulationParamsSchema = z.object({
  id: z.string().uuid('Formato de ID de simulação inválido'),
});

export const withdrawSimulationParamsSchema = z.object({
  id: z.string().uuid('Formato de ID de simulação inválido'),
});

export type CreateLoanSimulationDTO = z.infer<typeof createLoanSimulationSchema>;
export type ListLoanSimulationsQueryDTO = z.infer<typeof listLoanSimulationsQuerySchema>;
export type GetLoanSimulationParamsDTO = z.infer<typeof getLoanSimulationParamsSchema>;
export type ApproveSimulationParamsDTO = z.infer<typeof approveSimulationParamsSchema>;
export type WithdrawSimulationParamsDTO = z.infer<typeof withdrawSimulationParamsSchema>;
