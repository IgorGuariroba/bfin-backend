import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

const JWT_SECRET = process.env.JWT_SECRET!;

describe('POST /api/v1/transactions/:id/mark-as-received', () => {
  const createdUserIds: string[] = [];
  let token = '';
  let accountId = '';

  beforeEach(async () => {
    const email = `mark-received-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'Mark Received Tester' },
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
      await prisma.account.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  // ── Autenticação ───────────────────────────────────────────────────────────

  it('retorna 401 quando não há token', async () => {
    const response = await request(app)
      .post('/api/v1/transactions/some-id/mark-as-received');

    expect(response.status).toBe(401);
  });

  // ── Recurso não encontrado ─────────────────────────────────────────────────

  it('retorna 404 quando a transação não existe', async () => {
    const response = await request(app)
      .post('/api/v1/transactions/00000000-0000-0000-0000-000000000000/mark-as-received')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  // ── Validações de negócio ──────────────────────────────────────────────────

  it('retorna 400 quando a transação não é do tipo income', async () => {
    const tx = await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'fixed_expense',
        amount: 200,
        description: 'Despesa',
        due_date: new Date(),
        status: 'pending',
        is_floating: false,
      },
    });

    const response = await request(app)
      .post(`/api/v1/transactions/${tx.id}/mark-as-received`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it('retorna 400 quando a receita não está pendente', async () => {
    const tx = await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount: 500,
        description: 'Receita já executada',
        due_date: new Date(),
        status: 'executed',
        executed_date: new Date(),
        is_floating: false,
      },
    });

    const response = await request(app)
      .post(`/api/v1/transactions/${tx.id}/mark-as-received`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  // ── Caminho feliz ──────────────────────────────────────────────────────────

  it('marca receita como recebida e retorna breakdown correto', async () => {
    const amount = 1000;
    const tx = await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount,
        description: 'Salário',
        due_date: new Date(),
        status: 'pending',
        is_floating: false,
      },
    });

    const response = await request(app)
      .post(`/api/v1/transactions/${tx.id}/mark-as-received`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    const body = response.body;
    expect(body.transaction.status).toBe('executed');
    expect(body.breakdown.total_received).toBe(amount);
    // Regra padrão: 30% reserva, 70% disponível
    expect(body.breakdown.emergency_reserve).toBe(300);
    expect(body.breakdown.available).toBe(700);
    expect(body.account_balances.total_balance).toBeDefined();
    expect(body.account_balances.available_balance).toBeDefined();
  });

  it('aplica percentual customizado de reserva de emergência', async () => {
    // Criar regra de reserva de emergência com 20%
    await prisma.financialRule.create({
      data: {
        account_id: accountId,
        rule_type: 'emergency_reserve',
        rule_name: 'Reserva de Emergência',
        percentage: 20,
        priority: 1,
        is_active: true,
      },
    });

    const amount = 1000;
    const tx = await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount,
        description: 'Freelance',
        due_date: new Date(),
        status: 'pending',
        is_floating: false,
      },
    });

    const response = await request(app)
      .post(`/api/v1/transactions/${tx.id}/mark-as-received`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.breakdown.emergency_reserve).toBe(200);
    expect(response.body.breakdown.available).toBe(800);
  });

  it('atualiza o saldo da conta após marcar como recebida', async () => {
    const amount = 500;
    const tx = await prisma.transaction.create({
      data: {
        account_id: accountId,
        type: 'income',
        amount,
        description: 'Bônus',
        due_date: new Date(),
        status: 'pending',
        is_floating: false,
      },
    });

    await request(app)
      .post(`/api/v1/transactions/${tx.id}/mark-as-received`)
      .set('Authorization', `Bearer ${token}`);

    const updatedAccount = await prisma.account.findUnique({ where: { id: accountId } });
    expect(Number(updatedAccount!.total_balance)).toBe(amount);
    expect(Number(updatedAccount!.available_balance)).toBe(amount * 0.7);
    expect(Number(updatedAccount!.emergency_reserve)).toBe(amount * 0.3);
  });
});
