import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

const JWT_SECRET = process.env.JWT_SECRET!;

describe('POST /api/v1/transactions/expense - Recurring and Floating', () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  let token = '';
  let accountId = '';
  let categoryId = '';

  beforeEach(async () => {
    const email = `expense-recurring-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'Expense Recurring Tester' },
    });
    createdUserIds.push(user.id);

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Despesas',
        account_type: 'checking',
        is_default: true,
        available_balance: 2000,
        total_balance: 2000,
      },
    });
    accountId = account.id;

    const category = await prisma.category.create({
      data: {
        name: 'Moradia',
        type: 'fixed_expense',
        account_id: account.id,
      },
    });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.transaction.deleteMany({
        where: { account: { user_id: { in: createdUserIds } } },
      });
      await prisma.balanceHistory.deleteMany({
        where: { account: { user_id: { in: createdUserIds } } },
      });
      await prisma.category.deleteMany({
        where: { id: { in: createdCategoryIds } },
      });
      await prisma.account.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it('retorna 400 quando múltiplos tipos de fim de recorrência são fornecidos', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const response = await request(app)
      .post('/api/v1/transactions/expense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 500,
        description: 'Despesa recorrente',
        categoryId,
        type: 'fixed',
        dueDate: futureDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceCount: 12,
        recurrenceEndDate: '2026-12-31T00:00:00.000Z',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('define indefinite=true quando nenhum fim de recorrência é especificado', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const response = await request(app)
      .post('/api/v1/transactions/expense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 500,
        description: 'Despesa recorrente indefinida',
        categoryId,
        type: 'fixed',
        dueDate: futureDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'monthly',
      });

    expect(response.status).toBe(201);

    // Verificar transações criadas (12 instâncias para indefinido)
    const transactions = await prisma.transaction.findMany({
      where: { account_id: accountId },
    });
    expect(transactions.length).toBe(13); // 1 principal + 12 instâncias
  });

  it('cria despesa fixa flutuante sem data de vencimento', async () => {
    const response = await request(app)
      .post('/api/v1/transactions/expense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 1000,
        description: 'Dívida flutuante',
        categoryId,
        type: 'fixed',
        isFloating: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.transaction.is_floating).toBe(true);
    expect(response.body.transaction.due_date).toBeNull();
    expect(response.body.transaction.status).toBe('pending');

    // Verificar que não houve alteração no saldo
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    expect(Number(account!.available_balance)).toBe(2000);
  });

  it('cria despesa fixa futura sem bloquear saldo', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);

    const response = await request(app)
      .post('/api/v1/transactions/expense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 800,
        description: 'Despesa futura',
        categoryId,
        type: 'fixed',
        dueDate: futureDate.toISOString(),
      });

    expect(response.status).toBe(201);
    expect(response.body.transaction.status).toBe('pending');

    // Verificar que não houve alteração no saldo (despesa futura)
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    expect(Number(account!.available_balance)).toBe(2000);
    expect(Number(account!.locked_balance)).toBe(0);
  });

  it('retorna 400 quando dueDate é obrigatório para despesa não flutuante', async () => {
    const response = await request(app)
      .post('/api/v1/transactions/expense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 500,
        description: 'Despesa sem data',
        categoryId,
        type: 'fixed',
        isFloating: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('não cria parcelas quando diffMonths <= 0', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    const response = await request(app)
      .post('/api/v1/transactions/expense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 500,
        description: 'Despesa com data fim no passado',
        categoryId,
        type: 'fixed',
        dueDate: pastDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceEndDate: pastDate.toISOString(),
      });

    expect(response.status).toBe(201);

    // Deve criar apenas a transação principal
    const transactions = await prisma.transaction.findMany({
      where: { account_id: accountId },
    });
    expect(transactions.length).toBe(1);
  });

  it('cria despesa com recorrência semanal', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const response = await request(app)
      .post('/api/v1/transactions/expense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 100,
        description: 'Despesa semanal',
        categoryId,
        type: 'fixed',
        dueDate: futureDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'weekly',
        recurrenceCount: 4,
      });

    expect(response.status).toBe(201);

    const transactions = await prisma.transaction.findMany({
      where: { account_id: accountId },
    });
    expect(transactions.length).toBe(4);
  });

  it('cria despesa com recorrência anual', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const response = await request(app)
      .post('/api/v1/transactions/expense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 2000,
        description: 'Despesa anual',
        categoryId,
        type: 'fixed',
        dueDate: futureDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'yearly',
        recurrenceCount: 3,
      });

    expect(response.status).toBe(201);

    const transactions = await prisma.transaction.findMany({
      where: { account_id: accountId },
    });
    expect(transactions.length).toBe(3);
  });
});
