import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

const JWT_SECRET = process.env.JWT_SECRET!;

// Mês passado para testes de histórico
const NOW = new Date();
const CURRENT_YEAR = NOW.getUTCFullYear();
const CURRENT_MONTH = NOW.getUTCMonth() + 1;
const pastMonth = CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1;
const pastYear = CURRENT_MONTH === 1 ? CURRENT_YEAR - 1 : CURRENT_YEAR;

describe('GET /api/v1/cash-flow/monthly - Historical with Snapshots', () => {
  const createdUserIds: string[] = [];
  let token = '';
  let accountId = '';

  beforeEach(async () => {
    const email = `cashflow-snapshot-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'Snapshot Tester' },
    });
    createdUserIds.push(user.id);

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Snapshot',
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

  it('usa priorSnapshot como saldo inicial quando disponível', async () => {
    // Criar snapshot anterior ao mês passado
    const priorSnapshotDate = new Date(Date.UTC(pastYear, pastMonth - 1, 1));
    priorSnapshotDate.setUTCDate(priorSnapshotDate.getUTCDate() - 1);

    await prisma.balanceHistory.create({
      data: {
        account_id: accountId,
        available_balance: 5000,
        total_balance: 5000,
        locked_balance: 0,
        emergency_reserve: 0,
        recorded_at: priorSnapshotDate,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: pastYear, month: pastMonth });

    expect(response.status).toBe(200);
    expect(response.body.isHistorical).toBe(true);
    // O saldo inicial deve refletir o priorSnapshot
    expect(response.body.startBalance).toBe(5000);
  });

  it('atualiza saldo do dia quando existe snapshot para aquele dia', async () => {
    // Criar snapshot no dia 5 do mês passado
    const day5Snapshot = new Date(Date.UTC(pastYear, pastMonth - 1, 5, 12, 0, 0));

    await prisma.balanceHistory.create({
      data: {
        account_id: accountId,
        available_balance: 7500,
        total_balance: 7500,
        locked_balance: 0,
        emergency_reserve: 0,
        recorded_at: day5Snapshot,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: pastYear, month: pastMonth });

    expect(response.status).toBe(200);

    const day5Str = `${pastYear}-${String(pastMonth).padStart(2, '0')}-05`;
    const day5 = response.body.days.find((d: { date: string }) => d.date === day5Str);
    expect(day5).toBeDefined();
    expect(day5.balance).toBe(7500);
  });

  it('usa último snapshot do dia quando existem múltiplos no mesmo dia', async () => {
    // Criar dois snapshots no mesmo dia (manhã e tarde)
    const morningSnapshot = new Date(Date.UTC(pastYear, pastMonth - 1, 10, 10, 0, 0));
    const afternoonSnapshot = new Date(Date.UTC(pastYear, pastMonth - 1, 10, 15, 0, 0));

    await prisma.balanceHistory.create({
      data: {
        account_id: accountId,
        available_balance: 2000,
        total_balance: 2000,
        locked_balance: 0,
        emergency_reserve: 0,
        recorded_at: morningSnapshot,
      },
    });

    await prisma.balanceHistory.create({
      data: {
        account_id: accountId,
        available_balance: 3000,
        total_balance: 3000,
        locked_balance: 0,
        emergency_reserve: 0,
        recorded_at: afternoonSnapshot,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: pastYear, month: pastMonth });

    expect(response.status).toBe(200);

    const day10Str = `${pastYear}-${String(pastMonth).padStart(2, '0')}-10`;
    const day10 = response.body.days.find((d: { date: string }) => d.date === day10Str);
    expect(day10).toBeDefined();
    // Deve usar o valor do último snapshot do dia (tarde)
    expect(day10.balance).toBe(3000);
  });

  it('calcula dailyExpenses corretamente para transações executadas no mês passado', async () => {
    const executedDate = new Date(Date.UTC(pastYear, pastMonth - 1, 15));

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 300,
        description: 'Aluguel',
        executed_date: executedDate,
        status: 'executed',
        is_floating: false,
      },
    });

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'variable_expense',
        amount: 150,
        description: 'Mercado',
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

    const day15Str = `${pastYear}-${String(pastMonth).padStart(2, '0')}-15`;
    const day15 = response.body.days.find((d: { date: string }) => d.date === day15Str);
    expect(day15).toBeDefined();
    expect(day15.dailyExpenses).toBe(450); // 300 + 150
    expect(day15.transactions).toHaveLength(2);
  });

  it('ignora transações sem executed_date no mês histórico', async () => {
    const executedDate = new Date(Date.UTC(pastYear, pastMonth - 1, 20));

    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 1000,
        description: 'Salário',
        executed_date: executedDate,
        status: 'executed',
        is_floating: false,
      },
    });

    // Criar transação sem executed_date (não deve aparecer)
    await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 200,
        description: 'Despesa sem data execução',
        due_date: executedDate,
        status: 'pending',
        is_floating: false,
      },
    });

    const response = await request(app)
      .get('/api/v1/cash-flow/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ accountId, year: pastYear, month: pastMonth });

    expect(response.status).toBe(200);

    const day20Str = `${pastYear}-${String(pastMonth).padStart(2, '0')}-20`;
    const day20 = response.body.days.find((d: { date: string }) => d.date === day20Str);
    expect(day20).toBeDefined();
    expect(day20.transactions).toHaveLength(1);
    expect(day20.transactions[0].description).toBe('Salário');
  });
});
