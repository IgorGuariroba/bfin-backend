import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY,
  LOAN_SIMULATION_MAX_TERM_MONTHS,
  LOAN_SIMULATION_MIN_TERM_MONTHS,
} from '../../src/types';
import {
  createLoanSimulationSchema,
  listLoanSimulationsQuerySchema,
  getLoanSimulationParamsSchema,
  approveSimulationParamsSchema,
  withdrawSimulationParamsSchema,
  type CreateLoanSimulationDTO,
  type ListLoanSimulationsQueryDTO,
  type GetLoanSimulationParamsDTO,
  type ApproveSimulationParamsDTO,
  type WithdrawSimulationParamsDTO,
} from '../../src/validators/loanSimulationSchemas';

describe('loanSimulationSchemas', () => {
  describe('createLoanSimulationSchema', () => {
    it('should validate valid input', () => {
      const input = {
        amount: 1000,
        termMonths: 12,
      };

      const result = createLoanSimulationSchema.parse(input);

      expect(result).toEqual({
        amount: 1000,
        termMonths: 12,
        interestRateMonthly: LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY,
      });
    });

    it('should validate with custom interest rate', () => {
      const input = {
        amount: 1000,
        termMonths: 12,
        interestRateMonthly: 0.03,
      };

      const result = createLoanSimulationSchema.parse(input);

      expect(result).toEqual({
        amount: 1000,
        termMonths: 12,
        interestRateMonthly: 0.03,
      });
    });

    it('should accept minimum amount', () => {
      const input = {
        amount: 0.01,
        termMonths: LOAN_SIMULATION_MIN_TERM_MONTHS,
      };

      expect(() => createLoanSimulationSchema.parse(input)).not.toThrow();
    });

    it('should accept maximum term', () => {
      const input = {
        amount: 1000,
        termMonths: LOAN_SIMULATION_MAX_TERM_MONTHS,
      };

      expect(() => createLoanSimulationSchema.parse(input)).not.toThrow();
    });

    it('should throw for invalid amount type', () => {
      const input = {
        amount: '1000' as unknown as number,
        termMonths: 12,
      };

      expect(() => createLoanSimulationSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for amount less than minimum', () => {
      const input = {
        amount: 0.001,
        termMonths: 12,
      };

      expect(() => createLoanSimulationSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for term less than minimum', () => {
      const input = {
        amount: 1000,
        termMonths: LOAN_SIMULATION_MIN_TERM_MONTHS - 1,
      };

      expect(() => createLoanSimulationSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for term greater than maximum', () => {
      const input = {
        amount: 1000,
        termMonths: LOAN_SIMULATION_MAX_TERM_MONTHS + 1,
      };

      expect(() => createLoanSimulationSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for non-integer term', () => {
      const input = {
        amount: 1000,
        termMonths: 12.5,
      };

      expect(() => createLoanSimulationSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for negative interest rate', () => {
      const input = {
        amount: 1000,
        termMonths: 12,
        interestRateMonthly: -0.01,
      };

      expect(() => createLoanSimulationSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for interest rate greater than 1', () => {
      const input = {
        amount: 1000,
        termMonths: 12,
        interestRateMonthly: 1.01,
      };

      expect(() => createLoanSimulationSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('listLoanSimulationsQuerySchema', () => {
    it('should validate empty query', () => {
      const input = {};

      const result = listLoanSimulationsQuerySchema.parse(input);

      expect(result).toEqual({});
    });

    it('should validate with limit', () => {
      const input = { limit: '10' };

      const result = listLoanSimulationsQuerySchema.parse(input);

      expect(result).toEqual({ limit: 10 });
    });

    it('should validate with offset', () => {
      const input = { offset: '20' };

      const result = listLoanSimulationsQuerySchema.parse(input);

      expect(result).toEqual({ offset: 20 });
    });

    it('should validate with status', () => {
      const input = { status: 'PENDING' };

      const result = listLoanSimulationsQuerySchema.parse(input);

      expect(result).toEqual({ status: 'PENDING' });
    });

    it('should validate with all parameters', () => {
      const input = {
        limit: '50',
        offset: '10',
        status: 'APPROVED',
      };

      const result = listLoanSimulationsQuerySchema.parse(input);

      expect(result).toEqual({
        limit: 50,
        offset: 10,
        status: 'APPROVED',
      });
    });

    it('should throw for limit less than 1', () => {
      const input = { limit: '0' };

      expect(() => listLoanSimulationsQuerySchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for limit greater than 200', () => {
      const input = { limit: '201' };

      expect(() => listLoanSimulationsQuerySchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for negative offset', () => {
      const input = { offset: '-1' };

      expect(() => listLoanSimulationsQuerySchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for invalid status', () => {
      const input = { status: 'INVALID_STATUS' };

      expect(() => listLoanSimulationsQuerySchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('getLoanSimulationParamsSchema', () => {
    it('should validate valid simulation ID', () => {
      const input = { simulationId: 'sim-123' };

      const result = getLoanSimulationParamsSchema.parse(input);

      expect(result).toEqual({ simulationId: 'sim-123' });
    });

    it('should throw for empty simulation ID', () => {
      const input = { simulationId: '' };

      expect(() => getLoanSimulationParamsSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for missing simulation ID', () => {
      const input = {};

      expect(() => getLoanSimulationParamsSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('approveSimulationParamsSchema', () => {
    it('should validate valid UUID', () => {
      const input = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const result = approveSimulationParamsSchema.parse(input);

      expect(result).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    });

    it('should throw for invalid UUID format', () => {
      const input = { id: 'invalid-uuid' };

      expect(() => approveSimulationParamsSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for empty ID', () => {
      const input = { id: '' };

      expect(() => approveSimulationParamsSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('withdrawSimulationParamsSchema', () => {
    it('should validate valid UUID', () => {
      const input = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const result = withdrawSimulationParamsSchema.parse(input);

      expect(result).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    });

    it('should throw for invalid UUID format', () => {
      const input = { id: 'invalid-uuid' };

      expect(() => withdrawSimulationParamsSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should throw for empty ID', () => {
      const input = { id: '' };

      expect(() => withdrawSimulationParamsSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('Type exports', () => {
    it('should have correct types (compile-time check)', () => {
      // These are compile-time checks to ensure types are exported correctly
      const createDto: CreateLoanSimulationDTO = {
        amount: 1000,
        termMonths: 12,
        interestRateMonthly: 0.025,
      };

      const listDto: ListLoanSimulationsQueryDTO = {
        limit: 10,
        offset: 0,
      };

      const getDto: GetLoanSimulationParamsDTO = {
        simulationId: 'sim-123',
      };

      const approveDto: ApproveSimulationParamsDTO = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const withdrawDto: WithdrawSimulationParamsDTO = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      expect(createDto).toBeDefined();
      expect(listDto).toBeDefined();
      expect(getDto).toBeDefined();
      expect(approveDto).toBeDefined();
      expect(withdrawDto).toBeDefined();
    });
  });
});
