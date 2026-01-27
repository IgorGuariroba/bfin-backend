import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';
import { loanSimulationService } from '../../src/services/loanSimulationService';

describe('GET /api/v1/loan-simulations', () => {
  let userId = '';
  let accountId = '';
  let token = '';
  const simulationIds: string[] = [];

  beforeEach(async () => {
    simulationIds.length = 0;
    const email = `loan-sim-list-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: 'test-hash',
        full_name: 'Loan Simulation List Tester',
      },
    });

    userId = user.id;

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Principal',
        account_type: 'checking',
        is_default: true,
        emergency_reserve: 5000,
      },
    });

    accountId = account.id;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be defined to run integration tests');
    }

    token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: '1h' });

    const first = await loanSimulationService.createSimulation(user.id, {
      amount: 500,
      termMonths: 12,
    });
    const second = await loanSimulationService.createSimulation(user.id, {
      amount: 700,
      termMonths: 18,
    });

    simulationIds.push(first.id, second.id);
  });

  afterAll(async () => {
    if (simulationIds.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { simulation_id: { in: simulationIds } } });
      await prisma.cashFlowImpact.deleteMany({ where: { simulation_id: { in: simulationIds } } });
      await prisma.installmentPlan.deleteMany({ where: { simulation_id: { in: simulationIds } } });
      await prisma.loanSimulation.deleteMany({ where: { id: { in: simulationIds } } });
    }

    if (accountId) {
      await prisma.account.deleteMany({ where: { id: accountId } });
    }

    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it('lists simulations for the authenticated user', async () => {
    const response = await request(app)
      .get('/api/v1/loan-simulations?limit=10&offset=0')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    const returnedIds = response.body.map((item: { id: string }) => item.id);
    simulationIds.forEach((id) => {
      expect(returnedIds).toContain(id);
    });
  });
});
