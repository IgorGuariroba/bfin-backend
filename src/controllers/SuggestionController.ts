import { Request, Response } from 'express';
import { SuggestionEngine } from '../services/SuggestionEngine';

interface AuthRequest extends Request {
  userId?: string;
}

export class SuggestionController {
  /**
   * GET /api/v1/suggestions/daily-limit?account_id=xxx
   * Retorna o limite diário de gastos calculado
   */
  static async getDailyLimit(req: AuthRequest, res: Response) {
    try {
      const { account_id } = req.query;

      if (!account_id || typeof account_id !== 'string') {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'account_id is required',
        });
      }

      // Buscar limite diário
      const suggestion = await SuggestionEngine.getDailyLimit(account_id);

      // Buscar quanto já gastou hoje
      const spentToday = await SuggestionEngine.getSpentToday(account_id);

      // Verificar se excedeu o limite
      const limitStatus = await SuggestionEngine.isLimitExceeded(account_id);

      return res.status(200).json({
        accountId: suggestion.accountId,
        dailyLimit: suggestion.dailyLimit,
        availableBalance: suggestion.availableBalance,
        daysConsidered: suggestion.daysConsidered,
        spentToday,
        remaining: limitStatus.remaining,
        percentageUsed: limitStatus.percentageUsed,
        exceeded: limitStatus.exceeded,
        calculatedAt: suggestion.calculatedAt,
      });
    } catch (error: any) {
      console.error('Error getting daily limit:', error);

      if (error.message === 'Account not found') {
        return res.status(404).json({
          error: 'NotFound',
          message: 'Account not found',
        });
      }

      return res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to calculate daily limit',
      });
    }
  }

  /**
   * POST /api/v1/suggestions/recalculate?account_id=xxx
   * Força o recálculo do limite diário (invalidando cache)
   */
  static async recalculate(req: AuthRequest, res: Response) {
    try {
      const { account_id } = req.query;

      if (!account_id || typeof account_id !== 'string') {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'account_id is required',
        });
      }

      const suggestion = await SuggestionEngine.recalculateDailyLimit(account_id);

      return res.status(200).json({
        message: 'Daily limit recalculated successfully',
        accountId: suggestion.accountId,
        dailyLimit: suggestion.dailyLimit,
        availableBalance: suggestion.availableBalance,
        calculatedAt: suggestion.calculatedAt,
      });
    } catch (error: any) {
      console.error('Error recalculating daily limit:', error);

      if (error.message === 'Account not found') {
        return res.status(404).json({
          error: 'NotFound',
          message: 'Account not found',
        });
      }

      return res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to recalculate daily limit',
      });
    }
  }

  /**
   * GET /api/v1/suggestions/history?account_id=xxx&limit=30
   * Retorna o histórico de sugestões
   */
  static async getHistory(req: AuthRequest, res: Response) {
    try {
      const { account_id, limit } = req.query;

      if (!account_id || typeof account_id !== 'string') {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'account_id is required',
        });
      }

      const limitNumber = limit ? parseInt(limit as string, 10) : 30;

      const history = await SuggestionEngine.getHistory(account_id, limitNumber);

      return res.status(200).json({
        accountId: account_id,
        history,
        total: history.length,
      });
    } catch (error) {
      console.error('Error getting suggestion history:', error);

      return res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to get suggestion history',
      });
    }
  }

  /**
   * GET /api/v1/suggestions/spending-history?account_id=xxx&days=7
   * Retorna o histórico de gastos diários com limite
   */
  static async getSpendingHistory(req: AuthRequest, res: Response) {
    try {
      const { account_id, days } = req.query;

      if (!account_id || typeof account_id !== 'string') {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'account_id is required',
        });
      }

      const daysNumber = days ? parseInt(days as string, 10) : 7;

      // Validar range de dias
      if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 30) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'days must be a number between 1 and 30',
        });
      }

      const history = await SuggestionEngine.getSpendingHistory(account_id, daysNumber);

      return res.status(200).json(history);
    } catch (error: any) {
      console.error('Error getting spending history:', error);

      if (error.message === 'Account not found') {
        return res.status(404).json({
          error: 'NotFound',
          message: 'Account not found',
        });
      }

      if (error.message === 'Days must be between 1 and 30') {
        return res.status(400).json({
          error: 'BadRequest',
          message: error.message,
        });
      }

      return res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to get spending history',
      });
    }
  }

  /**
   * GET /api/v1/suggestions/status?account_id=xxx
   * Retorna o status do limite (excedido ou não)
   */
  static async getStatus(req: AuthRequest, res: Response) {
    try {
      const { account_id } = req.query;

      if (!account_id || typeof account_id !== 'string') {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'account_id is required',
        });
      }

      const status = await SuggestionEngine.isLimitExceeded(account_id);

      return res.status(200).json({
        accountId: account_id,
        ...status,
      });
    } catch (error) {
      console.error('Error getting limit status:', error);

      return res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to get limit status',
      });
    }
  }
}
