import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../src/lib/prisma';
import { NotFoundError, ValidationError } from '../../src/middlewares/errorHandler';
import { AccountService } from '../../src/services/AccountService';
import { auditEventService } from '../../src/services/AuditEventService';
import { loanSimulationService } from '../../src/services/loanSimulationService';

// Mock dependencies
vi.mock('../../src/lib/prisma', () => ({
  default: {
    $transaction: vi.fn((callback) => callback(prisma)),
    loanSimulation: {
      findFirst: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    account: {
      update: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/AccountService', () => {
  const AccountService = vi.fn();
  AccountService.prototype.getDefaultEmergencyReserve = vi.fn();
  return { AccountService };
});

vi.mock('../../src/services/AuditEventService', () => ({
  auditEventService: {
    writeEvent: vi.fn(),
  },
}));

describe('LoanSimulationService', () => {
  const userId = 'user-123';
  const simulationId = 'sim-123';
  const accountId = 'acc-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('approveSimulation', () => {
    it('should throw NotFoundError if simulation does not exist', async () => {
      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue(null);

      await expect(loanSimulationService.approveSimulation(userId, simulationId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ValidationError if simulation status is not PENDING', async () => {
      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue({
        id: simulationId,
        user_id: userId,
        status: 'APPROVED',
      } as any);

      await expect(loanSimulationService.approveSimulation(userId, simulationId)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if simulation is expired (>30 days)', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 31);

      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue({
        id: simulationId,
        user_id: userId,
        status: 'PENDING',
        created_at: expiredDate,
      } as any);

      await expect(loanSimulationService.approveSimulation(userId, simulationId)).rejects.toThrow(
        /expirada/
      );
    });

    it('should throw ValidationError if approval exceeds reserve limit', async () => {
      const createdDate = new Date();

      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue({
        id: simulationId,
        user_id: userId,
        status: 'PENDING',
        created_at: createdDate,
        principal_amount: 800,
        term_months: 12,
      } as any);

      // Setup AccountService mock return
      const mockGetDefaultEmergencyReserve = vi.mocked(
        AccountService.prototype.getDefaultEmergencyReserve
      );
      mockGetDefaultEmergencyReserve.mockResolvedValue({
        accountId,
        emergencyReserveAmount: 1000,
        currency: 'BRL',
      });

      // Mock aggregate to return existing loans that push over limit
      // Limit is 1000 (100% of 1000). Current sim is 800. 800 <= 1000, so we need existing loans
      vi.mocked(prisma.loanSimulation.aggregate).mockResolvedValue({
        _sum: { principal_amount: 300 },
      } as any);

      await expect(loanSimulationService.approveSimulation(userId, simulationId)).rejects.toThrow(
        /excederia o limite da reserva/
      );
    });

    it('should successfully approve simulation', async () => {
      const createdDate = new Date();

      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue({
        id: simulationId,
        user_id: userId,
        status: 'PENDING',
        created_at: createdDate,
        principal_amount: 500,
        term_months: 12,
        interest_rate_monthly: 0.01,
        installment_amount: 50,
      } as any);

      const mockGetDefaultEmergencyReserve = vi.mocked(
        AccountService.prototype.getDefaultEmergencyReserve
      );
      mockGetDefaultEmergencyReserve.mockResolvedValue({
        accountId,
        emergencyReserveAmount: 1000,
        currency: 'BRL',
      });

      vi.mocked(prisma.loanSimulation.aggregate).mockResolvedValue({
        _sum: { principal_amount: 0 },
      } as any);

      vi.mocked(prisma.loanSimulation.update).mockResolvedValue({
        id: simulationId,
        status: 'APPROVED',
        created_at: createdDate,
        principal_amount: 500,
        term_months: 12,
        interest_rate_monthly: 0.01,
        installment_amount: 50,
        installments: [],
      } as any);

      const result = await loanSimulationService.approveSimulation(userId, simulationId);

      expect(result.simulation.status).toBe('APPROVED');
      expect(prisma.loanSimulation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: simulationId },
          data: expect.objectContaining({ status: 'APPROVED' }),
        })
      );
      expect(auditEventService.writeEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'loan_simulation_approved' }),
        expect.anything()
      );
    });
  });

  describe('withdrawFunds', () => {
    it('should throw NotFoundError if simulation does not exist', async () => {
      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue(null);

      await expect(loanSimulationService.withdrawFunds(userId, simulationId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ValidationError if status is not APPROVED', async () => {
      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue({
        id: simulationId,
        user_id: userId,
        status: 'PENDING',
      } as any);

      await expect(loanSimulationService.withdrawFunds(userId, simulationId)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if insufficient reserve', async () => {
      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue({
        id: simulationId,
        user_id: userId,
        status: 'APPROVED',
        principal_amount: 600,
        account: {
          id: accountId,
          emergency_reserve: 500, // Less than principal
          available_balance: 100,
        },
      } as any);

      await expect(loanSimulationService.withdrawFunds(userId, simulationId)).rejects.toThrow(
        /Reserva de emergência insuficiente/
      );
    });

    it('should throw ValidationError if withdrawal exceeds reserve limit (re-check)', async () => {
      // Reserve 1000. Limit 1000 (100%).
      // Principal 600.
      // Active loans (other): 500.
      // Total: 1100 > 1000.
      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue({
        id: simulationId,
        user_id: userId,
        status: 'APPROVED',
        principal_amount: 600,
        account: {
          id: accountId,
          emergency_reserve: 1000,
          available_balance: 100,
        },
      } as any);

      vi.mocked(prisma.loanSimulation.aggregate).mockResolvedValue({
        _sum: { principal_amount: 500 },
      } as any);

      await expect(loanSimulationService.withdrawFunds(userId, simulationId)).rejects.toThrow(
        /excederia o limite da reserva/
      );
    });

    it('should successfully withdraw funds', async () => {
      const principalAmount = 500;
      const initialReserve = 1000;
      const initialAvailable = 100;

      vi.mocked(prisma.loanSimulation.findFirst).mockResolvedValue({
        id: simulationId,
        user_id: userId,
        status: 'APPROVED',
        principal_amount: principalAmount,
        term_months: 12,
        interest_rate_monthly: 0.01,
        installment_amount: 50,
        account: {
          id: accountId,
          emergency_reserve: initialReserve,
          available_balance: initialAvailable,
        },
      } as any);

      vi.mocked(prisma.loanSimulation.aggregate).mockResolvedValue({
        _sum: { principal_amount: 0 },
      } as any);

      vi.mocked(prisma.account.update).mockResolvedValue({
        id: accountId,
        emergency_reserve: initialReserve - principalAmount,
        available_balance: initialAvailable + principalAmount,
      } as any);

      vi.mocked(prisma.loanSimulation.update).mockResolvedValue({
        id: simulationId,
        status: 'COMPLETED',
        principal_amount: principalAmount,
        term_months: 12,
        interest_rate_monthly: 0.01,
        installment_amount: 50,
        installments: [],
      } as any);

      const result = await loanSimulationService.withdrawFunds(userId, simulationId);

      expect(result.simulation.status).toBe('COMPLETED');

      // Verify account update
      expect(prisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: accountId },
          data: {
            emergency_reserve: { decrement: principalAmount },
            available_balance: { increment: principalAmount },
          },
        })
      );

      // Verify simulation update
      expect(prisma.loanSimulation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: simulationId },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );

      // Verify audit event
      expect(auditEventService.writeEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'loan_simulation_withdrawn' }),
        expect.anything()
      );
    });
  });
});
