import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../../lib/prisma';
import { CategoryService } from '../../services/CategoryService';

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
      // Criar usuário e conta
      const user = await prisma.user.create({
        data: {
          email: `test${Date.now()}@example.com`,
          password_hash: 'hashed',
          full_name: 'Test User',
        },
      });

      const account = await prisma.account.create({
        data: {
          user_id: user.id,
          account_name: 'Test Account',
        },
      });

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
      const user = await prisma.user.create({
        data: {
          email: `test${Date.now()}@example.com`,
          password_hash: 'hashed',
          full_name: 'Test User',
        },
      });

      const account = await prisma.account.create({
        data: {
          user_id: user.id,
          account_name: 'Test Account',
        },
      });

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
      const user = await prisma.user.create({
        data: {
          email: `test${Date.now()}@example.com`,
          password_hash: 'hashed',
          full_name: 'Test User',
        },
      });

      const account = await prisma.account.create({
        data: {
          user_id: user.id,
          account_name: 'Test Account',
        },
      });

      const category = await categoryService.create({
        name: 'Salário',
        type: 'income',
        account_id: account.id,
      });

      expect(category.type).toBe('income');
    });

    it('should create expense category', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test${Date.now()}@example.com`,
          password_hash: 'hashed',
          full_name: 'Test User',
        },
      });

      const account = await prisma.account.create({
        data: {
          user_id: user.id,
          account_name: 'Test Account',
        },
      });

      const category = await categoryService.create({
        name: 'Transporte',
        type: 'expense',
        account_id: account.id,
      });

      expect(category.type).toBe('expense');
    });
  });
});
