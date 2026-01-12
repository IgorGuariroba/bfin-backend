import prisma from '../lib/prisma';

export class CategoryService {
  /**
   * List categories, optionally filter by type
   */
  async list(type?: 'income' | 'expense') {
    const where: any = {
      is_system: true, // Only return system categories for now
    };

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
      },
      orderBy: {
        name: 'asc',
      },
    });

    return categories;
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
        created_at: true,
      },
    });

    return category;
  }
}
