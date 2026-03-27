import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

describe('POST /api/v1/loan-simulations/:id/withdraw', () => {
  const createdUserIds: string[] = [];
  const createdAccountIds: string[] = [];
  const createdSimulationIds: string[] = [];

  let token = '';
  let userId = '';
  let accountId = '';

  beforeEach(async () => {
    const email = `loan-withdraw-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: 'test-hash',
        full_name: 'Loan Withdrawal Tester',
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
        available_balance: 5000, // R$ 5,000 available
      },
    });

    accountId = account.id;
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

  it('successfully withdraws funds from APPROVED simulation', async () => {
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

    // Withdraw funds
    const withdrawResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    expect(withdrawResponse.status).toBe(200);
    expect(withdrawResponse.body).toMatchObject({
      message: 'Fundos sacados com sucesso da reserva de emergência',
      simulation: {
        id: simulationId,
        status: 'COMPLETED',
        amount: 3000,
      },
      balances: {
        emergencyReserveBefore: 10000,
        emergencyReserveAfter: 7000,
        availableBalanceBefore: 5000,
        availableBalanceAfter: 8000,
      },
    });
    expect(withdrawResponse.body.simulation.withdrawnAt).toBeTruthy();

    // Verify persistence
    const persisted = await prisma.loanSimulation.findUnique({
      where: { id: simulationId },
    });

    expect(persisted?.status).toBe('COMPLETED');
    expect(persisted?.withdrawn_at).toBeTruthy();

    // Verify account balances updated
    const updatedAccount = await prisma.account.findUnique({
      where: { id: accountId },
    });

    expect(Number(updatedAccount?.emergency_reserve)).toBe(7000);
    expect(Number(updatedAccount?.available_balance)).toBe(8000);

    // Verify audit event was created
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        user_id: userId,
        simulation_id: simulationId,
        event_type: 'loan_simulation_withdrawn',
      },
    });

    expect(auditEvents.length).toBe(1);

    // Verify installment transactions were created
    const transactions = await prisma.transaction.findMany({
      where: {
        account_id: accountId,
        description: { contains: 'Empréstimo Reserva' },
      },
    });

    expect(transactions.length).toBe(12);
    expect(transactions[0].status).toBe('pending');
    expect(transactions[0].type).toBe('fixed_expense');

    // Check if a category was created/assigned
    const category = await prisma.category.findUnique({
      where: { id: transactions[0].category_id as string },
    });
    expect(category?.name).toBe('Empréstimo (Reserva)');
    expect(category?.is_system).toBe(true);
  });

  it('rejects withdrawal from PENDING simulation', async () => {
    // Create simulation without approving
    const createResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 2000, termMonths: 12 });

    const simulationId = createResponse.body.id;
    createdSimulationIds.push(simulationId);

    // Try to withdraw without approval
    const withdrawResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    expect(withdrawResponse.status).toBe(400);
    expect(withdrawResponse.body.error).toBe('ValidationError');
    expect(withdrawResponse.body.message).toContain('Não é possível sacar da simulação com status');
    expect(withdrawResponse.body.message).toContain('PENDING');
  });

  it('rejects withdrawal from already COMPLETED simulation', async () => {
    // Create, approve, and withdraw
    const createResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 2000, termMonths: 12 });

    const simulationId = createResponse.body.id;
    createdSimulationIds.push(simulationId);

    await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    // Try to withdraw again
    const secondWithdrawResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    expect(secondWithdrawResponse.status).toBe(400);
    expect(secondWithdrawResponse.body.error).toBe('ValidationError');
    expect(secondWithdrawResponse.body.message).toContain(
      'Não é possível sacar da simulação com status'
    );
    expect(secondWithdrawResponse.body.message).toContain('COMPLETED');
  });

  it('rejects withdrawal when reserve is insufficient', async () => {
    // Create and approve a simulation
    const createResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 4000, termMonths: 12 });

    const simulationId = createResponse.body.id;
    createdSimulationIds.push(simulationId);

    await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    // Reduce emergency reserve to make it insufficient
    await prisma.account.update({
      where: { id: accountId },
      data: { emergency_reserve: 3000 }, // Less than the 4000 needed
    });

    // Try to withdraw
    const withdrawResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    expect(withdrawResponse.status).toBe(400);
    expect(withdrawResponse.body.error).toBe('ValidationError');
    expect(withdrawResponse.body.message).toContain('Reserva de emergência insuficiente');
  });

  it('rejects withdrawal when reserve limit would be exceeded', async () => {
    // Create and approve first simulation (60% of reserve)
    const firstCreateResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 6000, termMonths: 12 });

    const firstSimulationId = firstCreateResponse.body.id;
    createdSimulationIds.push(firstSimulationId);

    await request(app)
      .post(`/api/v1/loan-simulations/${firstSimulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    // Create and approve second simulation (40% of reserve) - total 100%
    const secondCreateResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 4000, termMonths: 12 });

    const secondSimulationId = secondCreateResponse.body.id;
    createdSimulationIds.push(secondSimulationId);

    await request(app)
      .post(`/api/v1/loan-simulations/${secondSimulationId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    // Reduce emergency reserve to make 100% limit fail
    // With reserve=9000, 100% = 9000, but we have 10000 in approved loans
    await prisma.account.update({
      where: { id: accountId },
      data: { emergency_reserve: 9000 },
    });

    // Try to withdraw second simulation (would exceed 100% limit with reduced reserve)
    const withdrawResponse = await request(app)
      .post(`/api/v1/loan-simulations/${secondSimulationId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    expect(withdrawResponse.status).toBe(400);
    expect(withdrawResponse.body.error).toBe('ValidationError');
    expect(withdrawResponse.body.message).toContain('excederia o limite da reserva');
    expect(withdrawResponse.body.message).toContain('100%');
  });

  it('rejects withdrawal without authentication', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const response = await request(app).post(`/api/v1/loan-simulations/${fakeId}/withdraw`);

    expect(response.status).toBe(401);
  });

  it('rejects withdrawal with invalid UUID format', async () => {
    const invalidId = 'not-a-uuid';

    const response = await request(app)
      .post(`/api/v1/loan-simulations/${invalidId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeTruthy();
  });

  it('rejects withdrawal if simulation does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const response = await request(app)
      .post(`/api/v1/loan-simulations/${fakeId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NotFoundError');
    expect(response.body.message).toContain('não encontrada');
  });

  it('rejects withdrawal if simulation belongs to another user', async () => {
    // Create second user
    const secondUser = await prisma.user.create({
      data: {
        email: `loan-withdraw-other-${Date.now()}@example.com`,
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

    // Create and approve simulation as second user
    const createResponse = await request(app)
      .post('/api/v1/loan-simulations')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({ amount: 2000, termMonths: 12 });

    const simulationId = createResponse.body.id;
    createdSimulationIds.push(simulationId);

    await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/approve`)
      .set('Authorization', `Bearer ${secondUserToken}`);

    // Try to withdraw as first user
    const withdrawResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    expect(withdrawResponse.status).toBe(404);
    expect(withdrawResponse.body.error).toBe('NotFoundError');
    expect(withdrawResponse.body.message).toContain('não encontrada');
  });

  it('ensures transaction atomicity - no partial updates on failure', async () => {
    // This test verifies that if something fails during withdrawal,
    // no partial updates are persisted

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

    // Reduce reserve to make withdrawal fail
    await prisma.account.update({
      where: { id: accountId },
      data: { emergency_reserve: 2000 }, // Less than needed
    });

    // Try to withdraw (should fail)
    const withdrawResponse = await request(app)
      .post(`/api/v1/loan-simulations/${simulationId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);

    expect(withdrawResponse.status).toBe(400);

    // Verify no changes were persisted
    const simulationAfter = await prisma.loanSimulation.findUnique({
      where: { id: simulationId },
    });

    expect(simulationAfter?.status).toBe('APPROVED'); // Still APPROVED, not COMPLETED
    expect(simulationAfter?.withdrawn_at).toBeNull(); // No withdrawal timestamp
  });
});
