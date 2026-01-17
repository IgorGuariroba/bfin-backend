import prisma from '../lib/prisma';
import { NotFoundError } from '../middlewares/errorHandler';

export class CategoryService {
  /**
   * List categories, optionally filter by type and account
   */
  async list(type?: 'income' | 'expense', account_id?: string) {
    const where: any = {};

    if (account_id) {
      where.OR = [{ is_system: true }, { account_id }];
    } else {
      where.is_system = true;
    }

    if (type) {
      where.type = type;
    }

    const categories = await prisma.category.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        is_system: true,
        account_id: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return categories;
  }

  /**
   * Get category by ID
   */
  async getById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        is_system: true,
        account_id: true,
        created_at: true,
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return category;
  }

  /**
   * Create a new category
   */
  async create(data: {
    name: string;
    type: 'income' | 'expense';
    color?: string;
    icon?: string;
    account_id: string;
  }) {
    const category = await prisma.category.create({
      data: {
        name: data.name,
        type: data.type,
        color: data.color,
        icon: data.icon,
        account_id: data.account_id,
        is_system: false,
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        is_system: true,
        account_id: true,
        created_at: true,
      },
    });

    return category;
  }

  /**
   * Update a category
   */
  async update(
    id: string,
    data: {
      name?: string;
      color?: string;
      icon?: string;
      type?: 'income' | 'expense';
    }
  ) {
    // Check if exists first
    await this.getById(id);

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        color: data.color,
        icon: data.icon,
        type: data.type,
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        is_system: true,
        account_id: true,
      },
    });

    return category;
  }

  /**
   * Delete a category
   */
  async delete(id: string) {
    // Check if exists first
    await this.getById(id);

    await prisma.category.delete({
      where: { id },
    });

    return { message: 'Category deleted successfully' };
  }
}
