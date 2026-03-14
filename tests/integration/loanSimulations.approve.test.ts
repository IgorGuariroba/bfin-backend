import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

describe('POST /api/v1/loan-simulations/:id/approve', () => {
  const createdUserIds: string[] = [];
  const createdAccountIds: string[] = [];
  const createdSimulationIds: string[] = [];

  let token = '';
  let userId = '';

  beforeEach(async () => {
    const email = `loan-approve-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: 'test-hash',
        full_name: 'Loan Approval Tester',
      },
    });

    userId = user.id;
    createdUserIds.push(user.id);

    const account = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Reserva',
        account_type: 'checking',
        is_default: true,
        emergency_reserve: 10000, // R$ 10,000 reserve
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

  it('successfully approves a PENDING simulation', async () => {
    // Create a simulation
    const createResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5000, termMonths: 12 }); // 50% of 10,000 reserve

    expect(createResponse.status).toBe(201);
    const simulationId = createResponse.body.id;
    createdSimulationIds.push(simulationId);

    // Approve the simulation
    const approveResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body).toMatchObject({
      message: 'Loan simulation approved successfully',
      simulation: {
        id: simulationId,
        status: 'APPROVED',
        amount: 5000,
        termMonths: 12,
      },
    });
    expect(approveResponse.body.simulation.approvedAt).toBeTruthy();
    expect(approveResponse.body.simulation.withdrawnAt).toBeNull();

    // Verify persistence
    const persisted = await prisma.loanSimulation.findUnique({
      where: { id: simulationId },
    });

    expect(persisted?.status).toBe('APPROVED');
    expect(persisted?.approved_at).toBeTruthy();
    expect(persisted?.withdrawn_at).toBeNull();

    // Verify audit event was created
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        user_id: userId,
        simulation_id: simulationId,
        event_type: 'loan_simulation_approved',
      },
    });

    expect(auditEvents.length).toBe(1);
  });

  it('rejects approval if simulation does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const response = await request(app)
      .post(`/api/v1/loan-simulations/${fakeId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NotFoundError');
    expect(response.body.message).toContain('not found');
  });

  it('rejects approval if simulation is already APPROVED', async () => {
    // Create and approve a simulation
    const createResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 3000, termMonths: 12 });

    const simulationId = createResponse.body.id;
    createdSimulationIds.push(simulationId);

    await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    // Try to approve again
    const secondApprovalResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(secondApprovalResponse.status).toBe(400);
    expect(secondApprovalResponse.body.error).toBe('ValidationError');
    expect(secondApprovalResponse.body.message).toContain('Cannot approve simulation with status');
    expect(secondApprovalResponse.body.message).toContain('APPROVED');
  });

  it('rejects approval if simulation exceeds reserve limit', async () => {
    // Create first simulation (60% of reserve)
    const firstCreateResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 6000, termMonths: 12 });

    const firstSimulationId = firstCreateResponse.body.id;
    createdSimulationIds.push(firstSimulationId);

    // Approve first simulation
    await request(app)
      .post(`/api/v1/loan-simulations/${firstSimulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    // Create second simulation (50% of reserve)
    const secondCreateResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5000, termMonths: 12 });

    const secondSimulationId = secondCreateResponse.body.id;
    createdSimulationIds.push(secondSimulationId);

    // Try to approve second simulation (would total 110%, exceeds 100% limit)
    const approveResponse = await request(app)
      .post(`/api/v1/loan-simulations/${secondSimulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(approveResponse.status).toBe(400);
    expect(approveResponse.body.error).toBe('ValidationError');
    expect(approveResponse.body.message).toContain('exceed reserve limit');
    expect(approveResponse.body.message).toContain('100%');
  });

  it('rejects approval if simulation has expired (>30 days)', async () => {
    // Create a simulation
    const createResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 2000, termMonths: 12 });

    const simulationId = createResponse.body.id;
    createdSimulationIds.push(simulationId);

    // Manually update created_at to 31 days ago
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

    await prisma.loanSimulation.update({
      where: { id: simulationId },
      data: { created_at: thirtyOneDaysAgo },
    });

    // Try to approve expired simulation
    const approveResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(approveResponse.status).toBe(400);
    expect(approveResponse.body.error).toBe('ValidationError');
    expect(approveResponse.body.message).toContain('expired');
    expect(approveResponse.body.message).toContain('30 days');
  });

  it('rejects approval without authentication', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const response = await request(app).post(`/api/v1/loan-simulations/${fakeId}/approve`);

    expect(response.status).toBe(401);
  });

  it('rejects approval with invalid UUID format', async () => {
    const invalidId = 'not-a-uuid';

    const response = await request(app)
      .post(`/api/v1/loan-simulations/${invalidId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeTruthy();
  });

  it('rejects approval if simulation belongs to another user', async () => {
    // Create second user
    const secondUser = await prisma.user.create({
      data: {
        email: `loan-approve-other-${Date.now()}@example.com`,
        password_hash: 'test-hash',
        full_name: 'Other User',
      },
    });

    createdUserIds.push(secondUser.id);

    const secondAccount = await prisma.account.create({
      data: {
        user_id: secondUser.id,
        account_name: 'Other Account',
        account_type: 'checking',
        is_default: true,
        emergency_reserve: 5000,
      },
    });

    createdAccountIds.push(secondAccount.id);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be defined');
    }

    const secondUserToken = jwt.sign(
      { userId: secondUser.id, email: secondUser.email },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Create simulation as second user
    const createResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({ amount: 2000, termMonths: 12 });

    const simulationId = createResponse.body.id;
    createdSimulationIds.push(simulationId);

    // Try to approve as first user
    const approveResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(approveResponse.status).toBe(404);
    expect(approveResponse.body.error).toBe('NotFoundError');
    expect(approveResponse.body.message).toContain('not found');
  });
});
