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

  it('includes status, approvedAt, and withdrawnAt fields in response', async () => {
    const response = await request(app)
      .get('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);

    response.body.forEach((simulation: any) => {
      expect(simulation).toHaveProperty('status');
      expect(simulation).toHaveProperty('approvedAt');
      expect(simulation).toHaveProperty('withdrawnAt');
      expect(simulation.status).toBe('PENDING'); // All simulations in beforeEach are PENDING
      expect(simulation.approvedAt).toBeNull();
      expect(simulation.withdrawnAt).toBeNull();
    });
  });

  it('filters by status=APPROVED returning only approved simulations', async () => {
    // Approve first simulation
    await request(app)
      .post(`/api/v1/loan-simulations/${simulationIds[0]}/approve`)
      .set('Authorization', `Bearer ${token}`);

    const response = await request(app)
      .get('/api/v1/loan-simulations?status=APPROVED')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].id).toBe(simulationIds[0]);
    expect(response.body[0].status).toBe('APPROVED');
    expect(response.body[0].approvedAt).toBeTruthy();
    expect(response.body[0].withdrawnAt).toBeNull();
  });

  it('filters by status=COMPLETED returning only completed simulations', async () => {
    // Approve and withdraw first simulation
    await request(app)
      .post(`/api/v1/loan-simulations/${simulationIds[0]}/approve`)
      .set('Authorization', `Bearer ${token}`);

    await request(app)
      .post(`/api/v1/loan-simulations/${simulationIds[0]}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    const response = await request(app)
      .get('/api/v1/loan-simulations?status=COMPLETED')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].id).toBe(simulationIds[0]);
    expect(response.body[0].status).toBe('COMPLETED');
    expect(response.body[0].approvedAt).toBeTruthy();
    expect(response.body[0].withdrawnAt).toBeTruthy();
  });

  it('filters by status=PENDING returning only pending simulations', async () => {
    // Approve first simulation to have different statuses
    await request(app)
      .post(`/api/v1/loan-simulations/${simulationIds[0]}/approve`)
      .set('Authorization', `Bearer ${token}`);

    const response = await request(app)
      .get('/api/v1/loan-simulations?status=PENDING')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].id).toBe(simulationIds[1]);
    expect(response.body[0].status).toBe('PENDING');
    expect(response.body[0].approvedAt).toBeNull();
    expect(response.body[0].withdrawnAt).toBeNull();
  });

  it('returns 400 error for invalid status value', async () => {
    const response = await request(app)
      .get('/api/v1/loan-simulations?status=INVALID_STATUS')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('respects pagination with status filter', async () => {
    // Create more simulations
    const third = await loanSimulationService.createSimulation(userId, {
      amount: 300,
      termMonths: 12,
    });
    simulationIds.push(third.id);

    const fourth = await loanSimulationService.createSimulation(userId, {
      amount: 400,
      termMonths: 12,
    });
    simulationIds.push(fourth.id);

    // All 4 are PENDING, test pagination
    const firstPage = await request(app)
      .get('/api/v1/loan-simulations?status=PENDING&limit=2&offset=0')
      .set('Authorization', `Bearer ${token}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.length).toBe(2);

    const secondPage = await request(app)
      .get('/api/v1/loan-simulations?status=PENDING&limit=2&offset=2')
      .set('Authorization', `Bearer ${token}`);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.length).toBe(2);

    // Verify no overlap between pages
    const firstPageIds = firstPage.body.map((s: any) => s.id);
    const secondPageIds = secondPage.body.map((s: any) => s.id);
    const overlap = firstPageIds.filter((id: string) => secondPageIds.includes(id));
    expect(overlap.length).toBe(0);
  });

  it('returns simulations ordered by created_at desc (newest first)', async () => {
    // Create another simulation with a delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    const newest = await loanSimulationService.createSimulation(userId, {
      amount: 1000,
      termMonths: 12,
    });
    simulationIds.push(newest.id);

    const response = await request(app)
      .get('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(3);

    // First item should be the newest simulation
    expect(response.body[0].id).toBe(newest.id);

    // Verify descending order by createdAt
    for (let i = 0; i < response.body.length - 1; i++) {
      const current = new Date(response.body[i].createdAt);
      const next = new Date(response.body[i + 1].createdAt);
      expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
    }
  });

  it('returns empty array when no simulations match status filter', async () => {
    // All simulations are PENDING, filter by COMPLETED should return empty
    const response = await request(app)
      .get('/api/v1/loan-simulations?status=COMPLETED')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
