import { Request, Response } from 'express';
import { CategoryService } from '../services/CategoryService';

const categoryService = new CategoryService();

export class CategoryController {
  /**
   * GET /api/v1/categories
   */
  async list(req: Request, res: Response): Promise<void> {
    const { type } = req.query;

    const categories = await categoryService.list(type as 'income' | 'expense');

    res.json(categories);
  }
}
