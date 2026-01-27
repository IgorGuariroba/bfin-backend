import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

describe('POST /api/v1/loan-simulations', () => {
  const createdUserIds: string[] = [];
  const createdAccountIds: string[] = [];

  let token = '';

  beforeAll(async () => {
    const email = `loan-sim-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: 'test-hash',
        full_name: 'Loan Simulation Tester',
      },
    });

    createdUserIds.push(user.id);

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Reserva',
        account_type: 'checking',
        is_default: true,
        emergency_reserve: 1000,
      },
    });

    createdAccountIds.push(account.id);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be defined to run integration tests');
    }

    token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.cashFlowImpact.deleteMany({
        where: { simulation: { user_id: { in: createdUserIds } } },
      });
      await prisma.installmentPlan.deleteMany({
        where: { simulation: { user_id: { in: createdUserIds } } },
      });
      await prisma.loanSimulation.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.account.deleteMany({ where: { id: { in: createdAccountIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it('creates a loan simulation with fixed installments and persistence', async () => {
    const response = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500, termMonths: 12 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      amount: 500,
      termMonths: 12,
      amortizationType: 'PRICE',
    });
    expect(Array.isArray(response.body.installmentPlan)).toBe(true);
    expect(response.body.installmentPlan).toHaveLength(12);

    const persisted = await prisma.loanSimulation.findMany({
      where: { user_id: createdUserIds[0] },
    });
    expect(persisted.length).toBe(1);
  });
});
