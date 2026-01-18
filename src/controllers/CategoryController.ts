import type { Response } from 'express';
import prisma from '../lib/prisma';
import { ValidationError, ForbiddenError, NotFoundError } from '../middlewares/errorHandler';
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
    const { type, account_id } = req.query;

    if (account_id) {
      // Se pedir categorias de uma conta, precisa estar autenticado e ter acesso
      const userId = req.user?.userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      const access = await accountMemberService.checkAccess(String(account_id), userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Access denied to this account');
      }
    }

    const categories = await categoryService.list(
      type as 'income' | 'expense',
      account_id ? String(account_id) : undefined
    );

    res.json(categories);
  }

  /**
   * GET /api/v1/categories/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const category = await categoryService.getById(id);

    if (category.is_system) {
      res.json(category);
      return;
    }

    // Se não for do sistema, verificar acesso à conta
    const userId = req.user?.userId;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    if (category.account_id) {
      const access = await accountMemberService.checkAccess(category.account_id, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Access denied to this category');
      }
    }

    res.json(category);
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

    // Verificar se a conta existe primeiro
    const account = await prisma.account.findUnique({
      where: { id: account_id },
    });

    if (!account) {
      throw new NotFoundError(`Account with ID ${account_id} not found`);
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

  /**
   * PATCH /api/v1/categories/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, color, icon, type } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Buscar categoria para verificar permissões
    const category = await categoryService.getById(id);

    if (category.is_system) {
      throw new ForbiddenError('Cannot update system categories');
    }

    if (category.account_id) {
      const access = await accountMemberService.checkAccess(category.account_id, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Access denied to this account');
      }
    }

    // Atualizar
    const updatedCategory = await categoryService.update(id, {
      name,
      color,
      icon,
      type,
    });

    res.json(updatedCategory);
  }

  /**
   * DELETE /api/v1/categories/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Buscar categoria para verificar permissões
    const category = await categoryService.getById(id);

    if (category.is_system) {
      throw new ForbiddenError('Cannot delete system categories');
    }

    if (category.account_id) {
      const access = await accountMemberService.checkAccess(category.account_id, userId);
      if (!access.hasAccess) {
        throw new ForbiddenError('Access denied to this account');
      }
    }

    // Deletar
    const result = await categoryService.delete(id);

    res.json(result);
  }
}
