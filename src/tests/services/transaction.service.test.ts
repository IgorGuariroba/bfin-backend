import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../../lib/prisma';
import { TransactionService } from '../../services/TransactionService';

async function createTestUserAndAccount() {
  const user = await prisma.user.create({
    data: {
      email: `test_txn_${Date.now()}${Math.random()}@example.com`, // NOSONAR - not for security, just test uniqueness
      password_hash: 'test_hash_value', // NOSONAR - not a real password, test fixture only
      full_name: 'Test Transaction User',
    },
  });

  const account = await prisma.account.create({
    data: {
      user_id: user.id,
      account_name: 'Test Transaction Account',
      total_balance: 10000,
      available_balance: 10000,
    },
  });

  return { user, account };
}

describe('TransactionService', () => {
  let transactionService: TransactionService;

  beforeEach(() => {
    transactionService = new TransactionService();
  });

  describe('list with advanced filters', () => {
    it('should filter by statuses (pending, overdue, paid)', async () => {
      const { user, account } = await createTestUserAndAccount();

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create transactions
      // 1. Pending (future)
      await prisma.transaction.create({
        data: {
          account_id: account.id,
          type: 'fixed_expense',
          amount: 100,
          description: 'Future Pending',
          due_date: tomorrow,
          status: 'pending',
        },
      });

      // 2. Overdue (past pending)
      await prisma.transaction.create({
        data: {
          account_id: account.id,
          type: 'fixed_expense',
          amount: 200,
          description: 'Past Overdue',
          due_date: yesterday,
          status: 'pending',
        },
      });

      // 3. Paid (executed)
      await prisma.transaction.create({
        data: {
          account_id: account.id,
          type: 'variable_expense',
          amount: 300,
          description: 'Paid Expense',
          due_date: yesterday,
          executed_date: yesterday,
          status: 'executed',
        },
      });

      // Test filtering

      // Filter: Pending (should only get future pending)
      const pendingResult = await transactionService.list(user.id, {
        accountId: account.id,
        statuses: ['pending'],
      });
      expect(pendingResult.transactions).toHaveLength(1);
      expect(pendingResult.transactions[0].description).toBe('Future Pending');

      // Filter: Overdue (should only get past pending)
      const overdueResult = await transactionService.list(user.id, {
        accountId: account.id,
        statuses: ['overdue'],
      });
      expect(overdueResult.transactions).toHaveLength(1);
      expect(overdueResult.transactions[0].description).toBe('Past Overdue');

      // Filter: Paid
      const paidResult = await transactionService.list(user.id, {
        accountId: account.id,
        statuses: ['paid'],
      });
      expect(paidResult.transactions).toHaveLength(1);
      expect(paidResult.transactions[0].description).toBe('Paid Expense');

      // Filter: Pending AND Overdue
      const combinedResult = await transactionService.list(user.id, {
        accountId: account.id,
        statuses: ['pending', 'overdue'],
      });
      expect(combinedResult.transactions).toHaveLength(2);
      const descriptions = combinedResult.transactions.map((t: any) => t.description);
      expect(descriptions).toContain('Future Pending');
      expect(descriptions).toContain('Past Overdue');
      expect(descriptions).not.toContain('Paid Expense');
    });

    it('should filter by types', async () => {
      const { user, account } = await createTestUserAndAccount();
      const today = new Date();

      await prisma.transaction.createMany({
        data: [
          {
            account_id: account.id,
            type: 'income',
            amount: 1000,
            description: 'Salary',
            due_date: today,
            status: 'executed',
          },
          {
            account_id: account.id,
            type: 'fixed_expense',
            amount: 500,
            description: 'Rent',
            due_date: today,
            status: 'pending',
          },
          {
            account_id: account.id,
            type: 'variable_expense',
            amount: 50,
            description: 'Food',
            due_date: today,
            status: 'executed',
          },
        ],
      });

      const incomeResult = await transactionService.list(user.id, {
        accountId: account.id,
        types: ['income'],
      });
      expect(incomeResult.transactions).toHaveLength(1);
      expect(incomeResult.transactions[0].type).toBe('income');

      const expenseResult = await transactionService.list(user.id, {
        accountId: account.id,
        types: ['fixed_expense', 'variable_expense'],
      });
      expect(expenseResult.transactions).toHaveLength(2);
      expect(expenseResult.transactions.every((t: any) => t.type.includes('expense'))).toBe(true);
    });

    it('should filter by categories', async () => {
      const { user, account } = await createTestUserAndAccount();
      const today = new Date();

      const cat1 = await prisma.category.create({
        data: { name: 'Cat1', type: 'expense', account_id: account.id },
      });
      const cat2 = await prisma.category.create({
        data: { name: 'Cat2', type: 'expense', account_id: account.id },
      });

      await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: cat1.id,
          type: 'variable_expense',
          amount: 10,
          description: 'T1',
          due_date: today,
          status: 'executed',
        },
      });
      await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: cat2.id,
          type: 'variable_expense',
          amount: 20,
          description: 'T2',
          due_date: today,
          status: 'executed',
        },
      });

      const cat1Result = await transactionService.list(user.id, {
        accountId: account.id,
        categoryIds: [cat1.id],
      });
      expect(cat1Result.transactions).toHaveLength(1);
      expect(cat1Result.transactions[0].category_id).toBe(cat1.id);

      const bothResult = await transactionService.list(user.id, {
        accountId: account.id,
        categoryIds: [cat1.id, cat2.id],
      });
      expect(bothResult.transactions).toHaveLength(2);
    });
  });
});
