import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

const JWT_SECRET = process.env.JWT_SECRET!;

// Mês fixo para os testes: março/2026
const MONTH = 3;
const YEAR = 2026;

describe('GET /api/v1/reports/monthly-summary', () => {
  const createdUserIds: string[] = [];
  let token = '';
  let accountId = '';
  let categoryFoodId = '';
  let categoryTransportId = '';

  beforeEach(async () => {
    const email = `monthly-summary-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'Summary Tester' },
    });
    createdUserIds.push(user.id);

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Principal',
        account_type: 'checking',
        is_default: true,
        available_balance: 0,
        total_balance: 0,
      },
    });
    accountId = account.id;

    const categoryFood = await prisma.category.create({
      data: {
        account_id: account.id,
        name: 'Alimentação',
        type: 'expense',
        color: '#FF5733',
      },
    });
    categoryFoodId = categoryFood.id;

    const categoryTransport = await prisma.category.create({
      data: {
        account_id: account.id,
        name: 'Transporte',
        type: 'expense',
        color: '#3399FF',
      },
    });
    categoryTransportId = categoryTransport.id;

    token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.transaction.deleteMany({
        where: { account: { user_id: { in: createdUserIds } } },
      });
      await prisma.category.deleteMany({
        where: { account: { user_id: { in: createdUserIds } } },
      });
      await prisma.account.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  // ── Autenticação ────────────────────────────────────────────────────────────

  it('retorna 401 quando não há token de autenticação', async () => {
    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .query({ month: MONTH, year: YEAR });

    expect(response.status).toBe(401);
  });

  // ── Validação de parâmetros ─────────────────────────────────────────────────

  it('retorna 400 quando month é 0', async () => {
    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: 0, year: YEAR });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('retorna 400 quando month é 13', async () => {
    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: 13, year: YEAR });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('retorna 400 quando year é negativo', async () => {
    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: MONTH, year: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('retorna 400 quando month não é informado', async () => {
    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ year: YEAR });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('retorna 400 quando year não é informado', async () => {
    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: MONTH });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  // ── Mês sem transações ──────────────────────────────────────────────────────

  it('retorna zeros e lista vazia quando não há transações no mês', async () => {
    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: MONTH, year: YEAR });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      month: MONTH,
      year: YEAR,
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      expensesByCategory: [],
    });
  });

  // ── Cenário principal: totais e categorias ──────────────────────────────────

  it('retorna totalIncome, totalExpenses, balance e expensesByCategory corretos', async () => {
    const executedAt = (day: number) => new Date(Date.UTC(YEAR, MONTH - 1, day));

    // Receita executada no mês
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 5000,
        description: 'Salário',
        executed_date: executedAt(5),
        status: 'executed',
        is_floating: false,
      },
    });

    // Despesa de Alimentação: 800 (2 transações)
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        category_id: categoryFoodId,
        type: 'variable_expense',
        amount: 500,
        description: 'Mercado',
        executed_date: executedAt(10),
        status: 'executed',
        is_floating: false,
      },
    });
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        category_id: categoryFoodId,
        type: 'variable_expense',
        amount: 300,
        description: 'Restaurante',
        executed_date: executedAt(15),
        status: 'executed',
        is_floating: false,
      },
    });

    // Despesa de Transporte: 200
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        category_id: categoryTransportId,
        type: 'variable_expense',
        amount: 200,
        description: 'Uber',
        executed_date: executedAt(20),
        status: 'executed',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: MONTH, year: YEAR });

    expect(response.status).toBe(200);

    // Totais
    expect(response.body.month).toBe(MONTH);
    expect(response.body.year).toBe(YEAR);
    expect(response.body.totalIncome).toBe(5000);
    expect(response.body.totalExpenses).toBe(1000);   // 800 + 200
    expect(response.body.balance).toBe(4000);          // 5000 - 1000

    // expensesByCategory deve ter exatamente 2 entradas
    expect(response.body.expensesByCategory).toHaveLength(2);

    // Alimentação: 80% das despesas
    const food = response.body.expensesByCategory.find(
      (c: { categoryId: string }) => c.categoryId === categoryFoodId
    );
    expect(food).toBeDefined();
    expect(food.categoryName).toBe('Alimentação');
    expect(food.total).toBe(800);
    expect(food.percentage).toBeCloseTo(80, 1);

    // Transporte: 20% das despesas
    const transport = response.body.expensesByCategory.find(
      (c: { categoryId: string }) => c.categoryId === categoryTransportId
    );
    expect(transport).toBeDefined();
    expect(transport.categoryName).toBe('Transporte');
    expect(transport.total).toBe(200);
    expect(transport.percentage).toBeCloseTo(20, 1);
  });

  // ── Isolamento: apenas transações executadas no mês ─────────────────────────

  it('ignora transações com status pending', async () => {
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        category_id: categoryFoodId,
        type: 'variable_expense',
        amount: 999,
        description: 'Despesa pendente',
        due_date: new Date(Date.UTC(YEAR, MONTH - 1, 10)),
        status: 'pending',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: MONTH, year: YEAR });

    expect(response.status).toBe(200);
    expect(response.body.totalExpenses).toBe(0);
    expect(response.body.expensesByCategory).toHaveLength(0);
  });

  it('ignora transações executadas em outros meses', async () => {
    // Transação executada no mês anterior
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        category_id: categoryFoodId,
        type: 'variable_expense',
        amount: 500,
        description: 'Despesa de fevereiro',
        executed_date: new Date(Date.UTC(YEAR, MONTH - 2, 28)), // fevereiro/2026
        status: 'executed',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: MONTH, year: YEAR });

    expect(response.status).toBe(200);
    expect(response.body.totalExpenses).toBe(0);
    expect(response.body.expensesByCategory).toHaveLength(0);
  });

  it('receitas não aparecem em expensesByCategory', async () => {
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 3000,
        description: 'Receita do mês',
        executed_date: new Date(Date.UTC(YEAR, MONTH - 1, 1)),
        status: 'executed',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: MONTH, year: YEAR });

    expect(response.status).toBe(200);
    expect(response.body.totalIncome).toBe(3000);
    expect(response.body.expensesByCategory).toHaveLength(0);
  });

  // ── Shape da resposta ───────────────────────────────────────────────────────

  it('cada entrada de expensesByCategory tem os campos corretos', async () => {
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        category_id: categoryFoodId,
        type: 'variable_expense',
        amount: 100,
        description: 'Lanche',
        executed_date: new Date(Date.UTC(YEAR, MONTH - 1, 5)),
        status: 'executed',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/reports/monthly-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ month: MONTH, year: YEAR });

    expect(response.status).toBe(200);

    const category = response.body.expensesByCategory[0];
    expect(category).toHaveProperty('categoryId');
    expect(category).toHaveProperty('categoryName');
    expect(category).toHaveProperty('total');
    expect(category).toHaveProperty('percentage');

    // Não deve ter campos além do contrato
    expect(Object.keys(category)).toEqual(
      expect.arrayContaining(['categoryId', 'categoryName', 'total', 'percentage'])
    );
    // Não deve vazar detalhe de transações individuais
    expect(category).not.toHaveProperty('transactions');
  });
});
