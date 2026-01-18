import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../../lib/prisma';
import { CategoryService } from '../../services/CategoryService';

async function createTestUserAndAccount() {
  const user = await prisma.user.create({
    data: {
      email: `test${Date.now()}${Math.random()}@example.com`, // NOSONAR - not used for security, just unique test emails
      password_hash: 'test_hash_value', // NOSONAR - not a real password, test fixture only
      full_name: 'Test User',
    },
  });

  const account = await prisma.account.create({
    data: {
      user_id: user.id,
      account_name: 'Test Account',
    },
  });

  return { user, account };
}

describe('CategoryService', () => {
  let categoryService: CategoryService;

  beforeEach(() => {
    categoryService = new CategoryService();
  });

  describe('list', () => {
    it('should list all system categories', async () => {
      // Criar categorias do sistema
      await prisma.category.createMany({
        data: [
          { name: 'Alimentação', type: 'expense', is_system: true },
          { name: 'Transporte', type: 'expense', is_system: true },
          { name: 'Salário', type: 'income', is_system: true },
        ],
      });

      const categories = await categoryService.list();

      expect(categories.length).toBeGreaterThanOrEqual(3);
      expect(categories.every((cat) => cat.is_system)).toBe(true);
    });

    it('should filter categories by type', async () => {
      // Criar categorias do sistema
      await prisma.category.createMany({
        data: [
          { name: 'Alimentação', type: 'expense', is_system: true },
          { name: 'Transporte', type: 'expense', is_system: true },
          { name: 'Salário', type: 'income', is_system: true },
        ],
      });

      const expenseCategories = await categoryService.list('expense');
      const incomeCategories = await categoryService.list('income');

      expect(expenseCategories.every((cat) => cat.type === 'expense')).toBe(true);
      expect(incomeCategories.every((cat) => cat.type === 'income')).toBe(true);
      expect(expenseCategories.length).toBe(2);
      expect(incomeCategories.length).toBe(1);
    });

    it('should return categories sorted by name', async () => {
      await prisma.category.createMany({
        data: [
          { name: 'Zebra', type: 'expense', is_system: true },
          { name: 'Alpha', type: 'expense', is_system: true },
          { name: 'Beta', type: 'expense', is_system: true },
        ],
      });

      const categories = await categoryService.list();

      const names = categories.map((cat) => cat.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const { account } = await createTestUserAndAccount();

      const categoryData = {
        name: 'Alimentação',
        type: 'expense' as const,
        color: '#FF5733',
        icon: '🍔',
        account_id: account.id,
      };

      const category = await categoryService.create(categoryData);

      expect(category).toHaveProperty('id');
      expect(category.name).toBe(categoryData.name);
      expect(category.type).toBe(categoryData.type);
      expect(category.color).toBe(categoryData.color);
      expect(category.icon).toBe(categoryData.icon);
      expect(category.is_system).toBe(false);
    });

    it('should create category without optional fields', async () => {
      const { account } = await createTestUserAndAccount();

      const category = await categoryService.create({
        name: 'Simple Category',
        type: 'income',
        account_id: account.id,
      });

      expect(category.name).toBe('Simple Category');
      expect(category.color).toBeNull();
      expect(category.icon).toBeNull();
    });

    it('should create income category', async () => {
      const { account } = await createTestUserAndAccount();

      const category = await categoryService.create({
        name: 'Salário',
        type: 'income',
        account_id: account.id,
      });

      expect(category.type).toBe('income');
    });

    it('should create expense category', async () => {
      const { account } = await createTestUserAndAccount();

      const category = await categoryService.create({
        name: 'Transporte',
        type: 'expense',
        account_id: account.id,
      });

      expect(category.type).toBe('expense');
    });
  });

  describe('getById', () => {
    it('should get category by ID', async () => {
      const { account } = await createTestUserAndAccount();

      const createdCategory = await categoryService.create({
        name: 'Category to Find',
        type: 'expense',
        account_id: account.id,
      });

      const foundCategory = await categoryService.getById(createdCategory.id);

      expect(foundCategory.id).toBe(createdCategory.id);
      expect(foundCategory.name).toBe('Category to Find');
    });

    it('should throw NotFoundError for non-existent category', async () => {
      await expect(categoryService.getById('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        'Category not found'
      );
    });

    it('should return created_at field', async () => {
      const { account } = await createTestUserAndAccount();

      const createdCategory = await categoryService.create({
        name: 'Category with Date',
        type: 'income',
        account_id: account.id,
      });

      const foundCategory = await categoryService.getById(createdCategory.id);

      expect(foundCategory).toHaveProperty('created_at');
      expect(foundCategory.created_at).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('should update category name', async () => {
      const { account } = await createTestUserAndAccount();

      const createdCategory = await categoryService.create({
        name: 'Original Name',
        type: 'expense',
        account_id: account.id,
      });

      const updatedCategory = await categoryService.update(createdCategory.id, {
        name: 'Updated Name',
      });

      expect(updatedCategory.name).toBe('Updated Name');
      expect(updatedCategory.type).toBe('expense');
    });

    it('should update category color and icon', async () => {
      const { account } = await createTestUserAndAccount();

      const createdCategory = await categoryService.create({
        name: 'Category',
        type: 'expense',
        account_id: account.id,
      });

      const updatedCategory = await categoryService.update(createdCategory.id, {
        color: '#123456',
        icon: '🚀',
      });

      expect(updatedCategory.color).toBe('#123456');
      expect(updatedCategory.icon).toBe('🚀');
    });

    it('should update category type', async () => {
      const { account } = await createTestUserAndAccount();

      const createdCategory = await categoryService.create({
        name: 'Flexible Category',
        type: 'expense',
        account_id: account.id,
      });

      const updatedCategory = await categoryService.update(createdCategory.id, {
        type: 'income',
      });

      expect(updatedCategory.type).toBe('income');
    });

    it('should throw NotFoundError when updating non-existent category', async () => {
      await expect(
        categoryService.update('00000000-0000-0000-0000-000000000000', {
          name: 'New Name',
        })
      ).rejects.toThrow('Category not found');
    });
  });

  describe('delete', () => {
    it('should delete category successfully', async () => {
      const { account } = await createTestUserAndAccount();

      const createdCategory = await categoryService.create({
        name: 'Category to Delete',
        type: 'expense',
        account_id: account.id,
      });

      const result = await categoryService.delete(createdCategory.id);

      expect(result.message).toBe('Category deleted successfully');

      // Verificar que foi deletada
      await expect(categoryService.getById(createdCategory.id)).rejects.toThrow(
        'Category not found'
      );
    });

    it('should throw NotFoundError when deleting non-existent category', async () => {
      await expect(categoryService.delete('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        'Category not found'
      );
    });
  });

  describe('list with account_id', () => {
    it('should return system categories and account categories', async () => {
      const { account } = await createTestUserAndAccount();

      // Criar categoria do sistema
      await prisma.category.create({
        data: {
          name: 'System Category List Test',
          type: 'expense',
          is_system: true,
        },
      });

      // Criar categoria personalizada
      await categoryService.create({
        name: 'Custom Category',
        type: 'expense',
        account_id: account.id,
      });

      const categories = await categoryService.list(undefined, account.id);

      const systemCategory = categories.find((c) => c.name === 'System Category List Test');
      const customCategory = categories.find((c) => c.name === 'Custom Category');

      expect(systemCategory).toBeDefined();
      expect(customCategory).toBeDefined();
    });

    it('should filter by type when account_id is provided', async () => {
      const { account } = await createTestUserAndAccount();

      await categoryService.create({
        name: 'Expense Category',
        type: 'expense',
        account_id: account.id,
      });

      await categoryService.create({
        name: 'Income Category',
        type: 'income',
        account_id: account.id,
      });

      const expenseCategories = await categoryService.list('expense', account.id);
      const incomeCategories = await categoryService.list('income', account.id);

      expect(expenseCategories.every((c) => c.type === 'expense')).toBe(true);
      expect(incomeCategories.every((c) => c.type === 'income')).toBe(true);
    });
  });
});
