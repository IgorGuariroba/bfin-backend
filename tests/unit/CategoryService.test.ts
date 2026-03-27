import { describe, expect, it, vi, beforeEach } from 'vitest';
import prisma from '../../src/lib/prisma';
import { NotFoundError } from '../../src/middlewares/errorHandler';
import { CategoryService } from '../../src/services/CategoryService';

vi.mock('../../src/lib/prisma', () => ({
  default: {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('CategoryService', () => {
  let service: CategoryService;

  const mockCategory = {
    id: 'category-1',
    name: 'Test Category',
    type: 'expense' as const,
    color: '#FF0000',
    icon: 'icon-test',
    is_system: false,
    account_id: 'account-1',
    created_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CategoryService();
  });

  describe('list', () => {
    it('should list system categories when no account_id is provided', async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValue([mockCategory] as any);

      const result = await service.list();

      expect(result).toHaveLength(1);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { is_system: true },
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          icon: true,
          is_system: true,
          account_id: true,
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should list system and account categories when account_id is provided', async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValue([mockCategory] as any);

      const result = await service.list(undefined, 'account-1');

      expect(result).toHaveLength(1);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { OR: [{ is_system: true }, { account_id: 'account-1' }] },
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          icon: true,
          is_system: true,
          account_id: true,
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by type income', async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValue([mockCategory] as any);

      await service.list('income');

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { is_system: true, type: 'income' },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by type expense', async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValue([mockCategory] as any);

      await service.list('expense');

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { is_system: true, type: 'expense' },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by type and account_id', async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValue([mockCategory] as any);

      await service.list('expense', 'account-1');

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ is_system: true }, { account_id: 'account-1' }],
          type: 'expense',
        },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getById', () => {
    it('should return category when found', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(mockCategory as any);

      const result = await service.getById('category-1');

      expect(result).toEqual(mockCategory);
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'category-1' },
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
    });

    it('should throw NotFoundError when category not found', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(null);

      await expect(service.getById('category-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    const createData = {
      name: 'New Category',
      type: 'expense' as const,
      color: '#00FF00',
      icon: 'new-icon',
      account_id: 'account-1',
    };

    it('should create category successfully', async () => {
      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory as any);

      const result = await service.create(createData);

      expect(result).toEqual(mockCategory);
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'New Category',
          type: 'expense',
          color: '#00FF00',
          icon: 'new-icon',
          account_id: 'account-1',
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
    });

    it('should create category without optional fields', async () => {
      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory as any);

      await service.create({
        name: 'Simple Category',
        type: 'income',
        account_id: 'account-1',
      });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Simple Category',
          type: 'income',
          color: undefined,
          icon: undefined,
          account_id: 'account-1',
          is_system: false,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('update', () => {
    const updateData = {
      name: 'Updated Category',
      color: '#0000FF',
      icon: 'updated-icon',
    };

    it('should update category successfully', async () => {
      vi.mocked(prisma.category.findUnique)
        .mockResolvedValueOnce(mockCategory as any)
        .mockResolvedValueOnce(mockCategory as any);
      vi.mocked(prisma.category.update).mockResolvedValue({
        ...mockCategory,
        ...updateData,
      } as any);

      const result = await service.update('category-1', updateData);

      expect(result.name).toBe('Updated Category');
      expect(prisma.category.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete category successfully', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(mockCategory as any);
      vi.mocked(prisma.category.delete).mockResolvedValue(mockCategory as any);

      const result = await service.delete('category-1');

      expect(result).toEqual({ message: 'Categoria excluída com sucesso' });
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'category-1' },
      });
    });

    it('should throw NotFoundError when category not found', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(null);

      await expect(service.delete('category-1')).rejects.toThrow(NotFoundError);
    });
  });
});
