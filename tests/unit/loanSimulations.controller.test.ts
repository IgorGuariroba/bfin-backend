import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AuthRequest,
  LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY,
  type LoanSimulationDetails,
  type LoanSimulationSummary,
} from '../../src/types';

vi.mock('../../src/services/loanSimulationService', () => ({
  loanSimulationService: {
    createSimulation: vi.fn(),
    listSimulations: vi.fn(),
    getSimulation: vi.fn(),
  },
}));

import { loanSimulationsController } from '../../src/controllers/loanSimulations.controller';
import { loanSimulationService } from '../../src/services/loanSimulationService';

function createMockResponse() {
  const json = vi.fn();
  const res = {
    status: vi.fn().mockReturnThis(),
    json,
  } as unknown as Response;

  return { res, json };
}

function buildLoanSimulationDetails(
  overrides: Partial<LoanSimulationDetails> = {}
): LoanSimulationDetails {
  const base: LoanSimulationDetails = {
    id: 'sim-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    amount: 500,
    termMonths: 12,
    interestRateMonthly: LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY,
    amortizationType: 'PRICE',
    installmentAmount: 47.86,
    totalInterest: 74.32,
    totalCost: 574.32,
    reserveUsagePercent: 50,
    reserveRemainingAmount: 500,
    monthlyCashflowImpact: 47.86,
    installmentPlan: Array.from({ length: 12 }, (_, index) => ({
      installmentNumber: index + 1,
      principalComponent: 40,
      interestComponent: 7.86,
      totalPayment: 47.86,
      remainingBalance: Math.max(0, 500 - (index + 1) * 40),
    })),
  };

  return { ...base, ...overrides };
}

describe('LoanSimulationsController', () => {
  const mockedService = vi.mocked(loanSimulationService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('returns 401 when user is not authenticated', async () => {
      const { res, json } = createMockResponse();
      const req = { body: { amount: 500, termMonths: 12 } } as AuthRequest;

      await loanSimulationsController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockedService.createSimulation).not.toHaveBeenCalled();
    });

    it('parses input, applies defaults, and returns 201 with the created simulation', async () => {
      const { res, json } = createMockResponse();
      const req = {
        user: { userId: 'user-1', email: 'user@example.com' },
        body: { amount: 500, termMonths: 12 },
      } as AuthRequest;
      const simulation = buildLoanSimulationDetails();

      mockedService.createSimulation.mockResolvedValueOnce(simulation);

      await loanSimulationsController.create(req, res);

      expect(mockedService.createSimulation).toHaveBeenCalledWith('user-1', {
        amount: 500,
        termMonths: 12,
        interestRateMonthly: LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(simulation);
    });
  });

  describe('list', () => {
    it('returns 401 when user is not authenticated', async () => {
      const { res, json } = createMockResponse();
      const req = { query: {} } as AuthRequest;

      await loanSimulationsController.list(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockedService.listSimulations).not.toHaveBeenCalled();
    });

    it('coerces query params and returns the list of simulations', async () => {
      const { res, json } = createMockResponse();
      const req = {
        user: { userId: 'user-1', email: 'user@example.com' },
        query: { limit: '10', offset: '5' },
      } as unknown as AuthRequest;
      const simulations: LoanSimulationSummary[] = [
        {
          id: 'sim-2',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          amount: 300,
          termMonths: 10,
          interestRateMonthly: LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY,
          installmentAmount: 34.12,
        },
      ];

      mockedService.listSimulations.mockResolvedValueOnce(simulations);

      await loanSimulationsController.list(req, res);

      expect(mockedService.listSimulations).toHaveBeenCalledWith('user-1', 10, 5);
      expect(json).toHaveBeenCalledWith(simulations);
    });
  });

  describe('getById', () => {
    it('returns 401 when user is not authenticated', async () => {
      const { res, json } = createMockResponse();
      const req = { params: { simulationId: 'sim-1' } } as AuthRequest;

      await loanSimulationsController.getById(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockedService.getSimulation).not.toHaveBeenCalled();
    });

    it('parses params and returns the requested simulation', async () => {
      const { res, json } = createMockResponse();
      const req = {
        user: { userId: 'user-1', email: 'user@example.com' },
        params: { simulationId: 'sim-1' },
      } as unknown as AuthRequest;
      const simulation = buildLoanSimulationDetails({ id: 'sim-1' });

      mockedService.getSimulation.mockResolvedValueOnce(simulation);

      await loanSimulationsController.getById(req, res);

      expect(mockedService.getSimulation).toHaveBeenCalledWith('user-1', 'sim-1');
      expect(json).toHaveBeenCalledWith(simulation);
    });
  });
});
