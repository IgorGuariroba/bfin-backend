import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

const JWT_SECRET = process.env.JWT_SECRET!;

describe('DELETE /api/v1/transactions/:id', () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  let token = '';
  let accountId = '';

  beforeEach(async () => {
    const email = `delete-test-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'Delete Tester' },
    });
    createdUserIds.push(user.id);

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Delete',
        account_type: 'checking',
        is_default: true,
        available_balance: 5000,
        total_balance: 5000,
        locked_balance: 0,
        emergency_reserve: 1000,
      },
    });
    accountId = account.id;

    token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.balanceHistory.deleteMany({
        where: { account: { user_id: { in: createdUserIds } } },
      });
      await prisma.transaction.deleteMany({
        where: { account: { user_id: { in: createdUserIds } } },
      });
      await prisma.category.deleteMany({
        where: { id: { in: createdCategoryIds } },
      });
      await prisma.account.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it('retorna 401 quando não há token', async () => {
    const response = await request(app).delete('/api/v1/transactions/some-id');

    expect(response.status).toBe(401);
  });

  it('retorna 404 quando transação não existe', async () => {
    const response = await request(app)
      .delete('/api/v1/transactions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NotFoundError');
  });

  it('deleta transação pending sem alterar saldos', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'fixed_expense', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    const transaction = await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 500,
        description: 'Despesa pendente',
        status: 'pending',
        due_date: new Date(Date.now() + 86400000),
        category_id: category.id,
        is_floating: false,
      },
    });

    const accountBefore = await prisma.account.findUnique({ where: { id: accountId } });
    const availableBefore = Number(accountBefore!.available_balance);

    const response = await request(app)
      .delete(`/api/v1/transactions/${transaction.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Transação excluída com sucesso');

    const accountAfter = await prisma.account.findUnique({ where: { id: accountId } });
    expect(Number(accountAfter!.available_balance)).toBe(availableBefore);
  });

  it('deleta transação locked e reverte bloqueio', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'fixed_expense', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    const transaction = await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 800,
        description: 'Despesa bloqueada',
        status: 'locked',
        due_date: new Date(),
        category_id: category.id,
        is_floating: false,
      },
    });

    // Simular bloqueio no saldo
    await prisma.account.update({
      where: { id: accountId },
      data: {
        available_balance: 4200, // 5000 - 800
        locked_balance: 800,
      },
    });

    const response = await request(app)
      .delete(`/api/v1/transactions/${transaction.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    const accountAfter = await prisma.account.findUnique({ where: { id: accountId } });
    expect(Number(accountAfter!.available_balance)).toBe(5000);
    expect(Number(accountAfter!.locked_balance)).toBe(0);
  });

  it('deleta receita executed e reverte divisão 30/70', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'income', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    const transaction = await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 1000,
        description: 'Receita executada',
        status: 'executed',
        executed_date: new Date(),
        category_id: category.id,
        is_floating: false,
      },
    });

    // Simular saldo após recebimento da receita
    // 1000 total, 700 disponível (70%), 300 reserva (30%)
    await prisma.account.update({
      where: { id: accountId },
      data: {
        total_balance: 6000,
        available_balance: 5700,
        emergency_reserve: 1300,
      },
    });

    const response = await request(app)
      .delete(`/api/v1/transactions/${transaction.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    const accountAfter = await prisma.account.findUnique({ where: { id: accountId } });
    expect(Number(accountAfter!.total_balance)).toBe(5000);
    expect(Number(accountAfter!.available_balance)).toBe(5000);
    expect(Number(accountAfter!.emergency_reserve)).toBe(1000);
  });

  it('deleta despesa variável executed e reverte débito', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'variable_expense', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    const transaction = await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'variable_expense',
        amount: 300,
        description: 'Despesa variável',
        status: 'executed',
        executed_date: new Date(),
        category_id: category.id,
        is_floating: false,
      },
    });

    // Simular saldo após pagamento
    await prisma.account.update({
      where: { id: accountId },
      data: {
        total_balance: 4700,
        available_balance: 4700,
      },
    });

    const response = await request(app)
      .delete(`/api/v1/transactions/${transaction.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    const accountAfter = await prisma.account.findUnique({ where: { id: accountId } });
    expect(Number(accountAfter!.total_balance)).toBe(5000);
    expect(Number(accountAfter!.available_balance)).toBe(5000);
  });

  it('retorna 403 quando usuário não tem acesso à transação', async () => {
    // Criar outro usuário e conta
    const otherEmail = `other-delete-${Date.now()}@example.com`;
    const otherUser = await prisma.user.create({
      data: { email: otherEmail, password_hash: 'test-hash', full_name: 'Other User' },
    });
    createdUserIds.push(otherUser.id);

    const otherAccount = await prisma.account.create({
      data: {
        user_id: otherUser.id,
        account_name: 'Conta Outro',
        account_type: 'checking',
        is_default: true,
      },
    });

    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'income', account_id: otherAccount.id },
    });
    createdCategoryIds.push(category.id);

    const transaction = await prisma.transaction.create({
      data: {
        account_id: otherAccount.id,
        type: 'income',
        amount: 1000,
        description: 'Receita outro',
        status: 'pending',
        due_date: new Date(),
        category_id: category.id,
        is_floating: false,
      },
    });

    const response = await request(app)
      .delete(`/api/v1/transactions/${transaction.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('ForbiddenError');
  });
});
