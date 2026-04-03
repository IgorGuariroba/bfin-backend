import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

const JWT_SECRET = process.env.JWT_SECRET!;

describe('GET /api/v1/transactions - List with Filters', () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  let token = '';
  let accountId = '';
  let userId = '';

  beforeEach(async () => {
    const email = `list-filters-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'List Filters Tester' },
    });
    userId = user.id;
    createdUserIds.push(user.id);

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Listagem',
        account_type: 'checking',
        is_default: true,
        available_balance: 2000,
        total_balance: 2000,
      },
    });
    accountId = account.id;

    token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
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

  it('retorna 404 quando conta não existe', async () => {
    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId: '00000000-0000-0000-0000-000000000000' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NotFoundError');
  });

  it('retorna 403 quando usuário não tem acesso à conta', async () => {
    // Criar outro usuário e conta
    const otherEmail = `other-list-${Date.now()}@example.com`;
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

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId: otherAccount.id });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('ForbiddenError');
  });

  it('filtra por status paid (executed)', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'income', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 1000,
        description: 'Receita paga',
        status: 'executed',
        executed_date: new Date(),
        category_id: category.id,
        is_floating: false,
      },
    });

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 500,
        description: 'Receita pendente',
        status: 'pending',
        due_date: new Date(Date.now() + 86400000),
        category_id: category.id,
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, statuses: 'paid' });

    expect(response.status).toBe(200);
    expect(response.body.transactions).toHaveLength(1);
    expect(response.body.transactions[0].description).toBe('Receita paga');
  });

  it('filtra por status pending', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'income', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 500,
        description: 'Receita pendente futura',
        status: 'pending',
        due_date: new Date(Date.now() + 86400000),
        category_id: category.id,
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, statuses: 'pending' });

    expect(response.status).toBe(200);
    expect(response.body.transactions.length).toBeGreaterThan(0);
  });

  it('filtra por status overdue', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'fixed_expense', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 300,
        description: 'Despesa vencida',
        status: 'pending',
        due_date: new Date(Date.now() - 86400000),
        category_id: category.id,
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, statuses: 'overdue' });

    expect(response.status).toBe(200);
    expect(response.body.transactions.length).toBeGreaterThan(0);
  });

  it('filtra por múltiplos status', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'income', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    await prisma.transaction.create({
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

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 500,
        description: 'Despesa locked',
        status: 'locked',
        due_date: new Date(),
        category_id: category.id,
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, statuses: 'paid,locked' });

    expect(response.status).toBe(200);
    expect(response.body.transactions.length).toBeGreaterThanOrEqual(2);
  });

  it('filtra por tipos', async () => {
    const incomeCategory = await prisma.category.create({
      data: { name: 'Receitas', type: 'income', account_id: accountId },
    });
    const expenseCategory = await prisma.category.create({
      data: { name: 'Despesas', type: 'fixed_expense', account_id: accountId },
    });
    createdCategoryIds.push(incomeCategory.id, expenseCategory.id);

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 1000,
        description: 'Salário',
        status: 'executed',
        executed_date: new Date(),
        category_id: incomeCategory.id,
        is_floating: false,
      },
    });

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 500,
        description: 'Aluguel',
        status: 'locked',
        due_date: new Date(),
        category_id: expenseCategory.id,
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, types: 'income' });

    expect(response.status).toBe(200);
    expect(response.body.transactions.every((t: any) => t.type === 'income')).toBe(true);
  });

  it('filtra por categorias', async () => {
    const category1 = await prisma.category.create({
      data: { name: 'Categoria 1', type: 'income', account_id: accountId },
    });
    createdCategoryIds.push(category1.id);

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 1000,
        description: 'Receita filtrada',
        status: 'executed',
        executed_date: new Date(),
        category_id: category1.id,
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, categoryIds: category1.id });

    expect(response.status).toBe(200);
    expect(response.body.transactions.length).toBeGreaterThan(0);
  });

  it('retorna transações de todas as contas do usuário quando não informa accountId', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'income', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    // Criar segunda conta para o usuário
    const secondAccount = await prisma.account.create({
      data: {
        user_id: userId,
        account_name: 'Segunda Conta',
        account_type: 'savings',
        is_default: false,
      },
    });

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 1000,
        description: 'Receita conta 1',
        status: 'executed',
        executed_date: new Date(),
        category_id: category.id,
        is_floating: false,
      },
    });

    await prisma.transaction.create({
      data: {
        account_id: secondAccount.id,
        type: 'income',
        amount: 500,
        description: 'Receita conta 2',
        status: 'executed',
        executed_date: new Date(),
        category_id: category.id,
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.transactions.length).toBeGreaterThanOrEqual(2);
  });

  it('retorna resultados paginados corretamente', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'income', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    // Criar 5 transações
    for (let i = 0; i < 5; i++) {
      await prisma.transaction.create({
        data: {
          account_id: accountId,
          type: 'income',
          amount: 100 * (i + 1),
          description: `Receita ${i + 1}`,
          status: 'executed',
          executed_date: new Date(Date.now() - i * 86400000),
          category_id: category.id,
          is_floating: false,
        },
      });
    }

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, page: 1, limit: 2 });

    expect(response.status).toBe(200);
    expect(response.body.transactions).toHaveLength(2);
    expect(response.body.pagination.current_page).toBe(1);
    expect(response.body.pagination.items_per_page).toBe(2);
    expect(response.body.pagination.total_items).toBeGreaterThanOrEqual(5);
    expect(response.body.pagination.total_pages).toBeGreaterThanOrEqual(3);
  });

  it('filtra por intervalo de datas', async () => {
    const category = await prisma.category.create({
      data: { name: 'Teste', type: 'income', account_id: accountId },
    });
    createdCategoryIds.push(category.id);

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 1000,
        description: 'Receita ontem',
        status: 'executed',
        executed_date: yesterday,
        due_date: yesterday,
        category_id: category.id,
        is_floating: false,
      },
    });

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 500,
        description: 'Receita amanhã',
        status: 'pending',
        due_date: tomorrow,
        category_id: category.id,
        is_floating: false,
      },
    });

    const startDate = yesterday.toISOString();
    const endDate = now.toISOString();

    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, startDate, endDate });

    expect(response.status).toBe(200);
    expect(response.body.transactions.length).toBeGreaterThan(0);
  });
});
