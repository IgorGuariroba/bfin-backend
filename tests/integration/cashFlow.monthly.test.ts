import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

const JWT_SECRET = process.env.JWT_SECRET!;

// Hoje (UTC) para facilitar cálculo de mês futuro/passado
const NOW = new Date();
const CURRENT_YEAR = NOW.getUTCFullYear();
const CURRENT_MONTH = NOW.getUTCMonth() + 1; // 1-12

// Mês futuro: próximo mês
const futureMonth = CURRENT_MONTH === 12 ? 1 : CURRENT_MONTH + 1;
const futureYear = CURRENT_MONTH === 12 ? CURRENT_YEAR + 1 : CURRENT_YEAR;

// Mês passado: mês anterior
const pastMonth = CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1;
const pastYear = CURRENT_MONTH === 1 ? CURRENT_YEAR - 1 : CURRENT_YEAR;

describe('GET /api/v1/cash-flow/monthly', () => {
  const createdUserIds: string[] = [];
  let token = '';
  let accountId = '';

  beforeEach(async () => {
    const email = `cashflow-monthly-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'CashFlow Tester' },
    });
    createdUserIds.push(user.id);

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Principal',
        account_type: 'checking',
        is_default: true,
        available_balance: 1000,
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
      await prisma.balanceHistory.deleteMany({
        where: { account: { user_id: { in: createdUserIds } } },
      });
      await prisma.account.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  // ── Autenticação ───────────────────────────────────────────────────────────

  it('retorna 401 quando não há token de autenticação', async () => {
    const response = await request(app).get('/api/v1/cash-flow/monthly').query({
      accountId,
      year: futureYear,
      month: futureMonth,
    });

    expect(response.status).toBe(401);
  });

  // ── Validação de parâmetros ────────────────────────────────────────────────

  it('retorna 400 quando accountId não é um UUID válido', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId: 'not-a-uuid', year: futureYear, month: futureMonth });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('retorna 400 quando month é 0 (abaixo do mínimo)', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('retorna 400 quando month é 13 (acima do máximo)', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: 13 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('retorna 400 quando year está fora do range permitido', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: 1999, month: futureMonth });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  // ── Autorização / Recurso ──────────────────────────────────────────────────

  it('retorna 404 quando a conta não existe', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({
        accountId: '00000000-0000-0000-0000-000000000000',
        year: futureYear,
        month: futureMonth,
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NotFoundError');
  });

  it('retorna 403 quando a conta pertence a outro usuário', async () => {
    const otherEmail = `cashflow-other-${Date.now()}@example.com`;
    const otherUser = await prisma.user.create({
      data: { email: otherEmail, password_hash: 'hash', full_name: 'Other' },
    });
    createdUserIds.push(otherUser.id);

    const otherAccount = await prisma.account.create({
      data: {
        user_id: otherUser.id,
        account_name: 'Conta Alheia',
        account_type: 'checking',
        is_default: true,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId: otherAccount.id, year: futureYear, month: futureMonth });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('ForbiddenError');
  });

  // ── Projeção mês futuro — estrutura da resposta ────────────────────────────

  it('retorna 200 com estrutura correta para mês futuro', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: futureMonth });

    expect(response.status).toBe(200);

    const body = response.body;
    expect(body).toMatchObject({
      accountId,
      year: futureYear,
      month: futureMonth,
      isHistorical: false,
    });

    // Campos numéricos presentes
    expect(typeof body.startBalance).toBe('number');
    expect(typeof body.endBalance).toBe('number');
    expect(typeof body.totalFloatingDebt).toBe('number');
    expect(typeof body.remainingFloatingDebtAtEnd).toBe('number');

    // days é array com entradas para cada dia do mês
    expect(Array.isArray(body.days)).toBe(true);
    expect(body.days.length).toBeGreaterThan(0);
  });

  it('cada dia tem os campos corretos', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: futureMonth });

    expect(response.status).toBe(200);

    const day = response.body.days[0];
    expect(day).toHaveProperty('date');
    expect(day).toHaveProperty('balance');
    expect(day).toHaveProperty('remainingFloatingDebt');
    expect(day).toHaveProperty('isNegative');
    expect(day).toHaveProperty('dailyIncome');
    expect(day).toHaveProperty('dailyExpenses');
    expect(day).toHaveProperty('floatingDebtPayment');
    expect(day).toHaveProperty('transactions');
    expect(Array.isArray(day.transactions)).toBe(true);
  });

  // ── Projeção com transações pendentes ─────────────────────────────────────

  it('aplica receita pendente no dia correto e aumenta o saldo', async () => {
    // Receita de 500 no dia 15 do mês futuro
    const incomeDate = new Date(Date.UTC(futureYear, futureMonth - 1, 15));
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 500,
        description: 'Salário',
        due_date: incomeDate,
        status: 'pending',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: futureMonth });

    expect(response.status).toBe(200);

    const day15 = response.body.days.find(
      (d: { date: string }) => d.date === `${futureYear}-${String(futureMonth).padStart(2, '0')}-15`
    );
    expect(day15).toBeDefined();
    expect(day15.dailyIncome).toBe(500);
    expect(Array.isArray(day15.transactions)).toBe(true);
    expect(day15.transactions.length).toBeGreaterThan(0);
  });

  it('aplica despesa pendente no dia correto e reduz o saldo', async () => {
    // Despesa de 200 no dia 10 do mês futuro
    const expenseDate = new Date(Date.UTC(futureYear, futureMonth - 1, 10));
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 200,
        description: 'Aluguel',
        due_date: expenseDate,
        status: 'pending',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: futureMonth });

    expect(response.status).toBe(200);

    const day10 = response.body.days.find(
      (d: { date: string }) => d.date === `${futureYear}-${String(futureMonth).padStart(2, '0')}-10`
    );
    expect(day10).toBeDefined();
    expect(day10.dailyExpenses).toBe(200);
  });

  // ── Dívidas flutuantes ────────────────────────────────────────────────────

  it('inclui totalFloatingDebt quando há dívidas flutuantes', async () => {
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'variable_expense',
        amount: 300,
        description: 'Dívida sem data',
        is_floating: true,
        status: 'pending',
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: futureMonth });

    expect(response.status).toBe(200);
    expect(response.body.totalFloatingDebt).toBe(300);
  });

  it('abate dívida flutuante com saldo excedente e define debtFreeDate', async () => {
    // Conta com saldo 1000. Dívida flutuante de 300.
    // No primeiro dia da simulação (com saldo disponível > 0), deve abater 300.
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'variable_expense',
        amount: 300,
        description: 'Dívida flutuante',
        is_floating: true,
        status: 'pending',
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: futureMonth });

    expect(response.status).toBe(200);
    expect(response.body.totalFloatingDebt).toBe(300);
    expect(response.body.remainingFloatingDebtAtEnd).toBe(0);
    // debtFreeDate deve ser preenchido (dívida quitada dentro do mês)
    expect(response.body.debtFreeDate).not.toBeNull();
    expect(typeof response.body.debtFreeDate).toBe('string');
  });

  it('debtFreeDate é null quando dívida não é quitada no mês', async () => {
    // Conta com saldo 0. Dívida de 500 nunca será quitada sem receita.
    await prisma.account.update({
      where: { id: accountId },
      data: { available_balance: 0 },
    });

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'variable_expense',
        amount: 500,
        description: 'Dívida grande',
        is_floating: true,
        status: 'pending',
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: futureMonth });

    expect(response.status).toBe(200);
    expect(response.body.debtFreeDate).toBeNull();
    expect(response.body.remainingFloatingDebtAtEnd).toBeGreaterThan(0);
  });

  // ── Mês histórico ─────────────────────────────────────────────────────────

  it('retorna isHistorical: true para mês passado', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: pastYear, month: pastMonth });

    expect(response.status).toBe(200);
    expect(response.body.isHistorical).toBe(true);
    expect(response.body.totalFloatingDebt).toBe(0);
    expect(response.body.remainingFloatingDebtAtEnd).toBe(0);
    expect(response.body.debtFreeDate).toBeNull();
  });

  it('mês histórico retorna 28-31 dias conforme o mês', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: pastYear, month: pastMonth });

    expect(response.status).toBe(200);

    // Calcular dias esperados no mês passado
    const daysInMonth = new Date(Date.UTC(pastYear, pastMonth, 0)).getUTCDate();
    expect(response.body.days).toHaveLength(daysInMonth);
  });

  it('mês histórico usa transações executadas (status executed)', async () => {
    const executedDate = new Date(Date.UTC(pastYear, pastMonth - 1, 5));
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 250,
        description: 'Receita passada',
        executed_date: executedDate,
        status: 'executed',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: pastYear, month: pastMonth });

    expect(response.status).toBe(200);
    expect(response.body.isHistorical).toBe(true);

    const day5 = response.body.days.find(
      (d: { date: string }) => d.date === `${pastYear}-${String(pastMonth).padStart(2, '0')}-05`
    );
    expect(day5).toBeDefined();
    expect(day5.dailyIncome).toBe(250);
    expect(day5.transactions.length).toBeGreaterThan(0);
  });

  // ── Mês atual ────────────────────────────────────────────────────────────────

  it('mês atual retorna isHistorical: false', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: CURRENT_YEAR, month: CURRENT_MONTH });

    expect(response.status).toBe(200);
    expect(response.body.isHistorical).toBe(false);
  });

  it('mês atual retorna entradas para todos os dias do mês', async () => {
    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: CURRENT_YEAR, month: CURRENT_MONTH });

    expect(response.status).toBe(200);

    const daysInCurrentMonth = new Date(Date.UTC(CURRENT_YEAR, CURRENT_MONTH, 0)).getUTCDate();
    expect(response.body.days).toHaveLength(daysInCurrentMonth);
  });

  // ── Transações vencidas aplicadas no dia de hoje ──────────────────────────

  it('transação vencida (due_date ontem) é aplicada no dia de hoje na projeção', async () => {
    // Só faz sentido se hoje não é o primeiro dia do mês
    if (NOW.getUTCDate() <= 1) {
      return;
    }

    const yesterday = new Date(Date.UTC(CURRENT_YEAR, CURRENT_MONTH - 1, NOW.getUTCDate() - 1));

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 150,
        description: 'Receita vencida',
        due_date: yesterday,
        status: 'pending',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: CURRENT_YEAR, month: CURRENT_MONTH });

    expect(response.status).toBe(200);

    const todayStr = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}-${String(NOW.getUTCDate()).padStart(2, '0')}`;
    const todayDay = response.body.days.find((d: { date: string }) => d.date === todayStr);
    expect(todayDay).toBeDefined();
    // A transação vencida deve aparecer nas transações do dia de hoje
    expect(
      todayDay.transactions.some((t: { description: string }) => t.description === 'Receita vencida')
    ).toBe(true);
  });

  // ── Transações com status locked ──────────────────────────────────────────

  it('transação com status locked no mês futuro aparece na projeção', async () => {
    const lockedDate = new Date(Date.UTC(futureYear, futureMonth - 1, 20));
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 400,
        description: 'Despesa bloqueada',
        due_date: lockedDate,
        status: 'locked',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: futureYear, month: futureMonth });

    expect(response.status).toBe(200);

    const day20 = response.body.days.find(
      (d: { date: string }) =>
        d.date === `${futureYear}-${String(futureMonth).padStart(2, '0')}-20`
    );
    expect(day20).toBeDefined();
    expect(day20.dailyExpenses).toBe(400);
    expect(
      day20.transactions.some((t: { description: string }) => t.description === 'Despesa bloqueada')
    ).toBe(true);
  });

  // ── Histórico de saldo afetando dias passados do mês atual ────────────────

  it('balanceHistory de dia passado do mês atual afeta o saldo daquele dia', async () => {
    // Só faz sentido se hoje não é o primeiro dia do mês
    if (NOW.getUTCDate() <= 1) {
      return;
    }

    const pastDayOfCurrentMonth = new Date(Date.UTC(CURRENT_YEAR, CURRENT_MONTH - 1, 1, 12, 0, 0));
    const snapshotBalance = 9999;

    await prisma.balanceHistory.create({
      data: {
        account_id: accountId,
        available_balance: snapshotBalance,
        total_balance: snapshotBalance,
        locked_balance: 0,
        emergency_reserve: 0,
        recorded_at: pastDayOfCurrentMonth,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: CURRENT_YEAR, month: CURRENT_MONTH });

    expect(response.status).toBe(200);

    const day1Str = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}-01`;
    const day1 = response.body.days.find((d: { date: string }) => d.date === day1Str);
    expect(day1).toBeDefined();
    // O saldo do dia 1 deve refletir o snapshot, não o cálculo acumulado
    expect(day1.balance).toBe(snapshotBalance);
  });
});
