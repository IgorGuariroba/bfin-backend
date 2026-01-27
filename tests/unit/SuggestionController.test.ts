import type { Request, Response } from 'express';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuggestionController } from '../../src/controllers/SuggestionController';
import { SuggestionEngine } from '../../src/services/SuggestionEngine';

// Mock SuggestionEngine
vi.mock('../../src/services/SuggestionEngine');

describe('SuggestionController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let json: any;
  let status: any;

  beforeEach(() => {
    json = vi.fn();
    status = vi.fn().mockReturnValue({ json });
    req = {
      query: {},
    };
    res = {
      status,
      json,
    } as unknown as Response;
    vi.clearAllMocks();
  });

  describe('getDailyLimit', () => {
    it('should return daily limit successfully', async () => {
      req.query = { account_id: 'acc123' };
      const mockSuggestion = {
        accountId: 'acc123',
        dailyLimit: 100,
        availableBalance: 3000,
        daysConsidered: 30,
        calculatedAt: new Date(),
      };
      const mockSpent = 50;
      const mockStatus = {
        exceeded: false,
        remaining: 50,
        percentageUsed: 50,
        dailyLimit: 100,
        spentToday: 50,
      };

      vi.mocked(SuggestionEngine.getDailyLimit).mockResolvedValue(mockSuggestion);
      vi.mocked(SuggestionEngine.getSpentToday).mockResolvedValue(mockSpent);
      vi.mocked(SuggestionEngine.isLimitExceeded).mockResolvedValue(mockStatus);

      await SuggestionController.getDailyLimit(req as Request, res as Response);

      expect(SuggestionEngine.getDailyLimit).toHaveBeenCalledWith('acc123');
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        accountId: mockSuggestion.accountId,
        dailyLimit: mockSuggestion.dailyLimit,
        availableBalance: mockSuggestion.availableBalance,
        daysConsidered: mockSuggestion.daysConsidered,
        spentToday: mockSpent,
        remaining: mockStatus.remaining,
        percentageUsed: mockStatus.percentageUsed,
        exceeded: mockStatus.exceeded,
        calculatedAt: mockSuggestion.calculatedAt,
      });
    });

    it('should return 400 if account_id is missing', async () => {
      req.query = {};
      await SuggestionController.getDailyLimit(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'BadRequest' }));
    });

    it('should return 404 if account not found', async () => {
      req.query = { account_id: 'acc123' };
      vi.mocked(SuggestionEngine.getDailyLimit).mockRejectedValue(new Error('Account not found'));

      await SuggestionController.getDailyLimit(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'NotFound' }));
    });

    it('should return 500 for generic error', async () => {
      req.query = { account_id: 'acc123' };
      vi.mocked(SuggestionEngine.getDailyLimit).mockRejectedValue(new Error('Random error'));

      await SuggestionController.getDailyLimit(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'InternalServerError' }));
    });
  });

  describe('recalculate', () => {
    it('should recalculate daily limit successfully', async () => {
      req.query = { account_id: 'acc123' };
      const mockSuggestion = {
        accountId: 'acc123',
        dailyLimit: 100,
        availableBalance: 3000,
        daysConsidered: 30,
        calculatedAt: new Date(),
      };

      vi.mocked(SuggestionEngine.recalculateDailyLimit).mockResolvedValue(mockSuggestion);

      await SuggestionController.recalculate(req as Request, res as Response);

      expect(SuggestionEngine.recalculateDailyLimit).toHaveBeenCalledWith('acc123');
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Daily limit recalculated successfully',
          dailyLimit: 100,
        })
      );
    });

    it('should return 400 if account_id is missing', async () => {
      req.query = {};
      await SuggestionController.recalculate(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if account not found', async () => {
      req.query = { account_id: 'acc123' };
      vi.mocked(SuggestionEngine.recalculateDailyLimit).mockRejectedValue(
        new Error('Account not found')
      );

      await SuggestionController.recalculate(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(404);
    });

    it('should return 500 for generic error', async () => {
      req.query = { account_id: 'acc123' };
      vi.mocked(SuggestionEngine.recalculateDailyLimit).mockRejectedValue(
        new Error('Random error')
      );

      await SuggestionController.recalculate(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(500);
    });
  });

  describe('getHistory', () => {
    it('should get history successfully', async () => {
      req.query = { account_id: 'acc123', limit: '10' };
      const mockHistory = [
        { id: '1', dailyLimit: 100, availableBalance: 3000, createdAt: new Date() },
      ];

      vi.mocked(SuggestionEngine.getHistory).mockResolvedValue(mockHistory);

      await SuggestionController.getHistory(req as Request, res as Response);

      expect(SuggestionEngine.getHistory).toHaveBeenCalledWith('acc123', 10);
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        accountId: 'acc123',
        history: mockHistory,
        total: 1,
      });
    });

    it('should return 400 if account_id is missing', async () => {
      req.query = {};
      await SuggestionController.getHistory(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(400);
    });

    it('should return 500 for generic error', async () => {
      req.query = { account_id: 'acc123' };
      vi.mocked(SuggestionEngine.getHistory).mockRejectedValue(new Error('Random error'));

      await SuggestionController.getHistory(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSpendingHistory', () => {
    it('should get spending history successfully', async () => {
      req.query = { account_id: 'acc123', days: '7' };
      const mockHistoryResponse = {
        accountId: 'acc123',
        days: 7,
        history: [],
        totalSpent: 0,
        averageDailySpent: 0,
        daysWithSpending: 0,
      };

      vi.mocked(SuggestionEngine.getSpendingHistory).mockResolvedValue(mockHistoryResponse);

      await SuggestionController.getSpendingHistory(req as Request, res as Response);

      expect(SuggestionEngine.getSpendingHistory).toHaveBeenCalledWith('acc123', 7);
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(mockHistoryResponse);
    });

    it('should return 400 if account_id is missing', async () => {
      req.query = {};
      await SuggestionController.getSpendingHistory(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if days is invalid', async () => {
      req.query = { account_id: 'acc123', days: '31' };
      await SuggestionController.getSpendingHistory(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'days must be a number between 1 and 30' })
      );
    });

    it('should return 404 if account not found', async () => {
      req.query = { account_id: 'acc123' };
      vi.mocked(SuggestionEngine.getSpendingHistory).mockRejectedValue(
        new Error('Account not found')
      );

      await SuggestionController.getSpendingHistory(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if service throws invalid days error', async () => {
      req.query = { account_id: 'acc123' };
      vi.mocked(SuggestionEngine.getSpendingHistory).mockRejectedValue(
        new Error('Days must be between 1 and 30')
      );

      await SuggestionController.getSpendingHistory(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(400);
    });

    it('should return 500 for generic error', async () => {
      req.query = { account_id: 'acc123' };
      vi.mocked(SuggestionEngine.getSpendingHistory).mockRejectedValue(new Error('Random error'));

      await SuggestionController.getSpendingHistory(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(500);
    });
  });

  describe('getStatus', () => {
    it('should get status successfully', async () => {
      req.query = { account_id: 'acc123' };
      const mockStatus = {
        exceeded: false,
        dailyLimit: 100,
        spentToday: 50,
        remaining: 50,
        percentageUsed: 50,
      };

      vi.mocked(SuggestionEngine.isLimitExceeded).mockResolvedValue(mockStatus);

      await SuggestionController.getStatus(req as Request, res as Response);

      expect(SuggestionEngine.isLimitExceeded).toHaveBeenCalledWith('acc123');
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        accountId: 'acc123',
        ...mockStatus,
      });
    });

    it('should return 400 if account_id is missing', async () => {
      req.query = {};
      await SuggestionController.getStatus(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(400);
    });

    it('should return 500 for generic error', async () => {
      req.query = { account_id: 'acc123' };
      vi.mocked(SuggestionEngine.isLimitExceeded).mockRejectedValue(new Error('Random error'));

      await SuggestionController.getStatus(req as Request, res as Response);

      expect(status).toHaveBeenCalledWith(500);
    });
  });
});
