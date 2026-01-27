import { describe, it, expect } from 'vitest';
import {
  testRequest,
  createTestUser,
  createTestAccount,
  createTestCategory,
  getAuthHeader,
} from './helpers';
import prisma from '../lib/prisma';

describe('Transactions', () => {
  describe('POST /api/v1/transactions/income', () => {
    it('should create an income transaction and distribute balance (30/70)', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'Salary', 'income');

      const incomeData = {
        accountId: account.id,
        amount: 1000,
        description: 'Monthly Salary',
        categoryId: category.id,
        dueDate: new Date().toISOString(),
      };

      const response = await testRequest
        .post('/api/v1/transactions/income')
        .set(getAuthHeader(tokens.access_token))
        .send(incomeData)
        .expect(201);

      expect(Number(response.body.transaction.amount)).toBe(1000);
      expect(response.body.transaction.type).toBe('income');

      // Check breakdown (default 30% reserve)
      expect(Number(response.body.breakdown.emergency_reserve)).toBe(300);
      expect(Number(response.body.breakdown.available)).toBe(700);

      // Verify account balance update
      const updatedAccount = await prisma.account.findUnique({ where: { id: account.id } });
      expect(Number(updatedAccount?.total_balance)).toBe(1000);
      expect(Number(updatedAccount?.emergency_reserve)).toBe(300);
      expect(Number(updatedAccount?.available_balance)).toBe(700);
    });

    it('should fail if amount is negative', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'Salary', 'income');

      await testRequest
        .post('/api/v1/transactions/income')
        .set(getAuthHeader(tokens.access_token))
        .send({
          accountId: account.id,
          amount: -100,
          description: 'Negative Income',
          categoryId: category.id,
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/transactions/fixed-expense', () => {
    it('should create a fixed expense and lock balance', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      // Add initial balance
      await prisma.account.update({
        where: { id: account.id },
        data: { available_balance: 1000, total_balance: 1000 },
      });

      const category = await createTestCategory(account.id, 'Rent', 'expense');

      const expenseData = {
        accountId: account.id,
        amount: 500,
        description: 'Monthly Rent',
        categoryId: category.id,
        dueDate: new Date().toISOString(), // Today
      };

      const response = await testRequest
        .post('/api/v1/transactions/fixed-expense')
        .set(getAuthHeader(tokens.access_token))
        .send(expenseData)
        .expect(201);

      expect(response.body.transaction.status).toBe('locked');
      expect(Number(response.body.account_balances.locked_balance)).toBe(500);
      expect(Number(response.body.account_balances.available_balance)).toBe(500); // 1000 - 500
    });

    it('should fail if insufficient balance', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'Rent', 'expense');

      // Balance is 0 by default

      const expenseData = {
        accountId: account.id,
        amount: 500,
        description: 'Monthly Rent',
        categoryId: category.id,
        dueDate: new Date().toISOString(),
      };

      await testRequest
        .post('/api/v1/transactions/fixed-expense')
        .set(getAuthHeader(tokens.access_token))
        .send(expenseData)
        .expect(400); // InsufficientBalanceError maps to 400 usually, checking errorHandler might be needed but 400 is safe bet for logic error
    });
  });

  describe('POST /api/v1/transactions/variable-expense', () => {
    it('should create a variable expense and deduct immediately', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      // Add initial balance
      await prisma.account.update({
        where: { id: account.id },
        data: { available_balance: 200, total_balance: 200 },
      });

      const category = await createTestCategory(account.id, 'Food', 'expense');

      const expenseData = {
        accountId: account.id,
        amount: 50,
        description: 'Lunch',
        categoryId: category.id,
      };

      const response = await testRequest
        .post('/api/v1/transactions/variable-expense')
        .set(getAuthHeader(tokens.access_token))
        .send(expenseData)
        .expect(201);

      expect(response.body.transaction.status).toBe('executed');
      expect(Number(response.body.account_balances.available_balance)).toBe(150);
      expect(Number(response.body.account_balances.total_balance)).toBe(150);
    });
  });

  describe('GET /api/v1/transactions', () => {
    it('should list transactions with filters', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'General', 'expense');

      // Create a few transactions directly via DB to ensure state
      await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: category.id,
          amount: 100,
          type: 'income',
          description: 'Income 1',
          due_date: new Date(),
          status: 'executed',
        },
      });

      await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: category.id,
          amount: 50,
          type: 'variable_expense',
          description: 'Expense 1',
          due_date: new Date(),
          status: 'executed',
        },
      });

      const response = await testRequest
        .get('/api/v1/transactions')
        .query({ accountId: account.id })
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.transactions).toHaveLength(2);
      expect(response.body.pagination.total_items).toBe(2);
    });

    it('should filter by type', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'General', 'expense');

      await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: category.id,
          amount: 100,
          type: 'income',
          description: 'Inc',
          due_date: new Date(),
          status: 'executed',
        },
      });
      await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: category.id,
          amount: 50,
          type: 'variable_expense',
          description: 'Exp',
          due_date: new Date(),
          status: 'executed',
        },
      });

      const response = await testRequest
        .get('/api/v1/transactions')
        .query({ accountId: account.id, type: 'income' })
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.transactions).toHaveLength(1);
      expect(response.body.transactions[0].type).toBe('income');
    });
  });

  describe('GET /api/v1/transactions/:id', () => {
    it('should get transaction by id', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'General', 'income');

      const tx = await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: category.id,
          amount: 100,
          type: 'income',
          description: 'Test Tx',
          due_date: new Date(),
          status: 'executed',
        },
      });

      const response = await testRequest
        .get(`/api/v1/transactions/${tx.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.id).toBe(tx.id);
      expect(response.body.description).toBe('Test Tx');
    });
  });

  describe('PUT /api/v1/transactions/:id', () => {
    it('should update transaction description', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'General', 'income');

      const tx = await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: category.id,
          amount: 100,
          type: 'income',
          description: 'Old Desc',
          due_date: new Date(),
          status: 'executed',
        },
      });

      const response = await testRequest
        .put(`/api/v1/transactions/${tx.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({ description: 'New Desc' })
        .expect(200);

      expect(response.body.transaction.description).toBe('New Desc');
    });
  });

  describe('POST /api/v1/transactions/:id/mark-as-paid', () => {
    it('should mark fixed expense as paid', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'Rent', 'expense');

      // Setup account balance and locked amount
      await prisma.account.update({
        where: { id: account.id },
        data: { total_balance: 1000, locked_balance: 500, available_balance: 500 },
      });

      const tx = await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: category.id,
          amount: 500,
          type: 'fixed_expense',
          description: 'Rent',
          due_date: new Date(),
          status: 'locked',
        },
      });

      const response = await testRequest
        .post(`/api/v1/transactions/${tx.id}/mark-as-paid`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.transaction.status).toBe('executed');

      const updatedAccount = await prisma.account.findUnique({ where: { id: account.id } });
      // Locked balance should decrease, total balance should decrease (expense paid out)
      expect(Number(updatedAccount?.locked_balance)).toBe(0);
      expect(Number(updatedAccount?.total_balance)).toBe(500); // 1000 - 500
    });
  });

  describe('POST /api/v1/transactions/:id/duplicate', () => {
    it('should duplicate a transaction', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'General', 'income');

      const tx = await prisma.transaction.create({
        data: {
          account_id: account.id,
          category_id: category.id,
          amount: 100,
          type: 'income',
          description: 'Original',
          due_date: new Date(),
          status: 'executed',
        },
      });

      const response = await testRequest
        .post(`/api/v1/transactions/${tx.id}/duplicate`)
        .set(getAuthHeader(tokens.access_token))
        .expect(201);

      expect(response.body.transaction.description).toContain('(cópia)');
      expect(Number(response.body.transaction.amount)).toBe(100);
      expect(response.body.transaction.id).not.toBe(tx.id);
    });
  });

  describe('DELETE /api/v1/transactions/:id', () => {
    it('should delete a transaction and revert balance', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'General', 'income');

      // Setup: Account has 100 balance from income
      await prisma.account.update({
        where: { id: account.id },
        data: { total_balance: 100, available_balance: 100 },
      });

      // Use processIncome to ensure logic matches what we are reverting
      // Actually, let's manually create to test the delete logic specifically
      // But the delete logic assumes the transaction affected balance certain way.
      // Let's rely on delete logic:
      // Income deletion: reverts 30/70 split.

      // Let's create an income via API first to ensure correct state
      const incomeData = {
        accountId: account.id,
        amount: 100,
        description: 'Income to Delete',
        categoryId: category.id,
      };

      const createRes = await testRequest
        .post('/api/v1/transactions/income')
        .set(getAuthHeader(tokens.access_token))
        .send(incomeData)
        .expect(201);

      const txId = createRes.body.transaction.id;

      // Verify balance before delete
      const accBefore = await prisma.account.findUnique({ where: { id: account.id } });
      // Was 100 + 100 = 200 total
      expect(Number(accBefore?.total_balance)).toBe(200);

      await testRequest
        .delete(`/api/v1/transactions/${txId}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      const accAfter = await prisma.account.findUnique({ where: { id: account.id } });
      expect(Number(accAfter?.total_balance)).toBe(100); // Back to initial 100

      const tx = await prisma.transaction.findUnique({ where: { id: txId } });
      expect(tx).toBeNull();
    });
  });
});
