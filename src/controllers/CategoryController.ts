import type { Response } from 'express';
import { ValidationError, ForbiddenError } from '../middlewares/errorHandler';
import { AccountMemberService } from '../services/AccountMemberService';
import { CategoryService } from '../services/CategoryService';
import type { AuthRequest } from '../types';

const categoryService = new CategoryService();
const accountMemberService = new AccountMemberService();

export class CategoryController {
  /**
   * GET /api/v1/categories
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    const { type } = req.query;

    const categories = await categoryService.list(type as 'income' | 'expense');

    res.json(categories);
  }

  /**
   * POST /api/v1/categories
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    const { name, type, color, icon, account_id } = req.body;

    // Validar campos obrigatórios
    if (!name || !type) {
      throw new ValidationError('Name and type are required');
    }

    if (!account_id) {
      throw new ValidationError('Account ID is required');
    }

    // Validar tipo
    if (type !== 'income' && type !== 'expense') {
      throw new ValidationError('Type must be either "income" or "expense"');
    }

    // Obter user_id do token
    const userId = req.user?.userId;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Verificar se o usuário tem acesso à conta
    const access = await accountMemberService.checkAccess(account_id, userId);
    if (!access.hasAccess) {
      throw new ForbiddenError('Access denied to this account');
    }

    const category = await categoryService.create({
      name,
      type,
      color,
      icon,
      account_id,
    });

    res.status(201).json(category);
  }
}
