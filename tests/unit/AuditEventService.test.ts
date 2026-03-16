import { describe, expect, it, vi, beforeEach } from 'vitest';
import prisma from '../../src/lib/prisma';
import { AuditEventService, type AuditEventInput } from '../../src/services/AuditEventService';

vi.mock('../../src/lib/prisma', () => ({
  default: {
    auditEvent: {
      create: vi.fn(),
    },
  },
}));

describe('AuditEventService', () => {
  let service: AuditEventService;

  const mockAuditInput: AuditEventInput = {
    userId: 'user-1',
    accountId: 'account-1',
    eventType: 'LOAN_SIMULATION_CREATED',
    simulationId: 'simulation-1',
    payload: { amount: 1000, termMonths: 12 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditEventService();
  });

  describe('writeEvent', () => {
    it('should create audit event successfully', async () => {
      const mockAuditEvent = {
        id: 'audit-1',
        ...mockAuditInput,
        created_at: new Date(),
      };
      vi.mocked(prisma.auditEvent.create).mockResolvedValue(mockAuditEvent as any);

      const result = await service.writeEvent(mockAuditInput);

      expect(result).toEqual(mockAuditEvent);
      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-1',
          account_id: 'account-1',
          simulation_id: 'simulation-1',
          event_type: 'LOAN_SIMULATION_CREATED',
          payload: { amount: 1000, termMonths: 12 },
        },
      });
    });

    it('should create audit event without optional fields', async () => {
      const mockAuditEvent = {
        id: 'audit-1',
        userId: 'user-1',
        accountId: 'account-1',
        eventType: 'ACCOUNT_CREATED',
        created_at: new Date(),
      };
      vi.mocked(prisma.auditEvent.create).mockResolvedValue(mockAuditEvent as any);

      await service.writeEvent({
        userId: 'user-1',
        accountId: 'account-1',
        eventType: 'ACCOUNT_CREATED',
      });

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-1',
          account_id: 'account-1',
          simulation_id: undefined,
          event_type: 'ACCOUNT_CREATED',
          payload: undefined,
        },
      });
    });

    it('should use provided transaction client when available', async () => {
      const mockTxClient = {
        auditEvent: {
          create: vi.fn(),
        },
      };
      const mockAuditEvent = {
        id: 'audit-1',
        ...mockAuditInput,
        created_at: new Date(),
      };
      vi.mocked(mockTxClient.auditEvent.create).mockResolvedValue(mockAuditEvent as any);

      await service.writeEvent(mockAuditInput, mockTxClient as any);

      expect(mockTxClient.auditEvent.create).toHaveBeenCalled();
      expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('auditEventService singleton', () => {
    it('should export singleton instance', async () => {
      const { auditEventService } = await import('../../src/services/AuditEventService');
      expect(auditEventService).toBeInstanceOf(AuditEventService);
    });
  });
});
