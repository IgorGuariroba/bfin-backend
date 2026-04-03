import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

const JWT_SECRET = process.env.JWT_SECRET!;

describe('POST /api/v1/transactions/income - Recurring', () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  let token = '';
  let accountId = '';
  let categoryId = '';

  beforeEach(async () => {
    const email = `recurring-income-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'Recurring Income Tester' },
    });
    createdUserIds.push(user.id);

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Recorrência',
        account_type: 'checking',
        is_default: true,
        available_balance: 1000,
        total_balance: 1000,
      },
    });
    accountId = account.id;

    const category = await prisma.category.create({
      data: {
        name: 'Salário',
        type: 'income',
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
      .post('/api/v1/transactions/income')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 1000,
        description: 'Receita recorrente',
        categoryId,
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
      .post('/api/v1/transactions/income')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 1000,
        description: 'Receita recorrente indefinida',
        categoryId,
        dueDate: futureDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'monthly',
      });

    expect(response.status).toBe(201);

    // Verificar que 12 instâncias foram criadas (padrão para indefinido)
    const transactions = await prisma.transaction.findMany({
      where: { account_id: accountId },
    });
    expect(transactions.length).toBe(13); // 1 principal + 12 instâncias
  });

  it('cria receita agendada com recurrenceCount', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    const response = await request(app)
      .post('/api/v1/transactions/income')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 1000,
        description: 'Receita com contagem',
        categoryId,
        dueDate: futureDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceCount: 6,
      });

    expect(response.status).toBe(201);

    // Deve criar 6 transações no total (1 + 5)
    const transactions = await prisma.transaction.findMany({
      where: { account_id: accountId },
    });
    expect(transactions.length).toBe(6);
  });

  it('cria receita agendada com recurrenceEndDate', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6);

    const response = await request(app)
      .post('/api/v1/transactions/income')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 1000,
        description: 'Receita com data fim',
        categoryId,
        dueDate: futureDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceEndDate: endDate.toISOString(),
      });

    expect(response.status).toBe(201);

    // Verificar transações criadas
    const transactions = await prisma.transaction.findMany({
      where: { account_id: accountId },
    });
    expect(transactions.length).toBeGreaterThan(1);
  });

  it('cria receita com recorrência semanal', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const response = await request(app)
      .post('/api/v1/transactions/income')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 500,
        description: 'Receita semanal',
        categoryId,
        dueDate: futureDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'weekly',
        recurrenceCount: 5,
      });

    expect(response.status).toBe(201);

    const transactions = await prisma.transaction.findMany({
      where: { account_id: accountId },
    });
    expect(transactions.length).toBe(5);
  });

  it('cria receita com recorrência anual', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const response = await request(app)
      .post('/api/v1/transactions/income')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 5000,
        description: 'Receita anual',
        categoryId,
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

  it('cria receita com intervalo de recorrência', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const response = await request(app)
      .post('/api/v1/transactions/income')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: 1000,
        description: 'Receita bimestral',
        categoryId,
        dueDate: futureDate.toISOString(),
        isRecurring: true,
        recurrencePattern: 'monthly',
        recurrenceInterval: 2,
        recurrenceCount: 4,
      });

    expect(response.status).toBe(201);

    const transactions = await prisma.transaction.findMany({
      where: { account_id: accountId },
      orderBy: { due_date: 'asc' },
    });
    expect(transactions.length).toBe(4);

    // Verificar intervalo de 2 meses entre transações
    for (let i = 1; i < transactions.length; i++) {
      const current = new Date(transactions[i].due_date!);
      const previous = new Date(transactions[i - 1].due_date!);
      const diffMonths =
        (current.getFullYear() - previous.getFullYear()) * 12 +
        (current.getMonth() - previous.getMonth());
      expect(diffMonths).toBe(2);
    }
  });
});
