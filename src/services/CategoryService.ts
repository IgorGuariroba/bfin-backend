import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}
