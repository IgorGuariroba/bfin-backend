import { Response } from 'express';
import { AccountService } from '../services/AccountService';
import { AuthRequest } from '../types';
import { z } from 'zod';

const accountService = new AccountService();

// Schemas de validação
const createAccountSchema = z.object({
  account_name: z.string().min(1, 'Account name is required'),
  account_type: z.enum(['checking', 'savings', 'investment']).optional(),
  is_default: z.boolean().optional(),
});

const updateAccountSchema = z.object({
  account_name: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
});

export class AccountController {
  /**
   * GET /api/v1/accounts
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const accounts = await accountService.listByUser(req.user.userId);

    res.json({ accounts });
  }

  /**
   * GET /api/v1/accounts/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const account = await accountService.getById(id, req.user.userId);

    res.json(account);
  }

  /**
   * POST /api/v1/accounts
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validar dados
    const data = createAccountSchema.parse(req.body);

    const account = await accountService.create(req.user.userId, data);

    res.status(201).json(account);
  }

  /**
   * PATCH /api/v1/accounts/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const data = updateAccountSchema.parse(req.body);

    const account = await accountService.update(id, req.user.userId, data);

    res.json(account);
  }

  /**
   * DELETE /api/v1/accounts/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const result = await accountService.delete(id, req.user.userId);

    res.json(result);
  }
}
