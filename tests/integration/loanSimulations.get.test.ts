import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';
import { loanSimulationService } from '../../src/services/loanSimulationService';

describe('GET /api/v1/loan-simulations/:simulationId', () => {
  let userId = '';
  let accountId = '';
  let token = '';
  let simulationId = '';

  beforeEach(async () => {
    const email = `loan-sim-get-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: 'test-hash',
        full_name: 'Loan Simulation Get Tester',
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

    const simulation = await loanSimulationService.createSimulation(user.id, {
      amount: 800,
      termMonths: 20,
    });

    simulationId = simulation.id;
  });

  afterAll(async () => {
    if (simulationId) {
      await prisma.auditEvent.deleteMany({ where: { simulation_id: simulationId } });
      await prisma.cashFlowImpact.deleteMany({ where: { simulation_id: simulationId } });
      await prisma.installmentPlan.deleteMany({ where: { simulation_id: simulationId } });
      await prisma.loanSimulation.deleteMany({ where: { id: simulationId } });
    }

    if (accountId) {
      await prisma.account.deleteMany({ where: { id: accountId } });
    }

    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it('returns simulation details for the authenticated user', async () => {
    const response = await request(app)
      .get(`/api/v1/loan-simulations/${simulationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: simulationId,
      amount: 800,
      termMonths: 20,
      amortizationType: 'PRICE',
    });
    expect(Array.isArray(response.body.installmentPlan)).toBe(true);
    expect(response.body.installmentPlan).toHaveLength(20);
  });
});
