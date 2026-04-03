import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

const JWT_SECRET = process.env.JWT_SECRET!;

describe('POST /api/v1/transactions/transfer', () => {
  const createdUserIds: string[] = [];
  let token = '';
  let sourceAccountId = '';
  let destinationAccountId = '';
  let userId = '';

  beforeEach(async () => {
    const email = `transfer-test-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'Transfer Tester' },
    });
    userId = user.id;
    createdUserIds.push(user.id);

    const sourceAccount = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Origem',
        account_type: 'checking',
        is_default: true,
        available_balance: 1000,
        total_balance: 1000,
      },
    });
    sourceAccountId = sourceAccount.id;

    const destinationAccount = await prisma.account.create({
      data: {
        user_id: user.id,
        account_name: 'Conta Destino',
        account_type: 'savings',
        is_default: false,
        available_balance: 0,
        total_balance: 0,
      },
    });
    destinationAccountId = destinationAccount.id;

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
      await prisma.auditEvent.deleteMany({
        where: { account: { user_id: { in: createdUserIds } } },
      });
      await prisma.notification.deleteMany({
        where: { user_id: { in: createdUserIds } },
      });
      await prisma.account.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it('retorna 401 quando não há token', async () => {
    const response = await request(app).post('/api/v1/transactions/transfer').send({
      sourceAccountId,
      destinationAccountId,
      amount: 100,
    });

    expect(response.status).toBe(401);
  });

  it('retorna 400 quando valor é <= 0', async () => {
    const response = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId,
        destinationAccountId,
        amount: 0,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('retorna 400 quando contas de origem e destino são iguais', async () => {
    const response = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId,
        destinationAccountId: sourceAccountId,
        amount: 100,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('retorna 404 quando conta de origem não existe', async () => {
    const response = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId: '00000000-0000-0000-0000-000000000000',
        destinationAccountId,
        amount: 100,
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NotFoundError');
  });

  it('retorna 403 quando usuário não é dono da conta de origem', async () => {
    // Criar outro usuário e conta
    const otherEmail = `other-transfer-${Date.now()}@example.com`;
    const otherUser = await prisma.user.create({
      data: { email: otherEmail, password_hash: 'test-hash', full_name: 'Other User' },
    });
    createdUserIds.push(otherUser.id);

    const otherAccount = await prisma.account.create({
      data: {
        user_id: otherUser.id,
        account_name: 'Conta Outro Usuário',
        account_type: 'checking',
        is_default: true,
        available_balance: 1000,
        total_balance: 1000,
      },
    });

    const response = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId: otherAccount.id,
        destinationAccountId,
        amount: 100,
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('ForbiddenError');
  });

  it('retorna 422 quando saldo é insuficiente', async () => {
    const response = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId,
        destinationAccountId,
        amount: 5000,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('InsufficientBalanceError');
  });

  it('retorna 404 quando conta de destino não existe', async () => {
    const response = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId,
        destinationAccountId: '00000000-0000-0000-0000-000000000000',
        amount: 100,
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NotFoundError');
  });

  it('realiza transferência com sucesso entre contas do mesmo usuário', async () => {
    // Criar categoria de transferência do sistema
    await prisma.category.create({
      data: {
        name: 'Transferência',
        type: 'transfer',
        is_system: true,
      },
    });

    const amount = 500;
    const response = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId,
        destinationAccountId,
        amount,
        description: 'Transferência teste',
      });

    expect(response.status).toBe(201);
    expect(response.body.transfer).toBeDefined();
    expect(response.body.transfer.amount).toBe(amount);
    expect(response.body.transfer.sourceAccount.id).toBe(sourceAccountId);
    expect(response.body.transfer.destinationAccount.id).toBe(destinationAccountId);
    expect(response.body.debitTransaction).toBeDefined();
    expect(response.body.creditTransaction).toBeDefined();

    // Verificar saldos atualizados
    const updatedSource = await prisma.account.findUnique({ where: { id: sourceAccountId } });
    const updatedDest = await prisma.account.findUnique({ where: { id: destinationAccountId } });

    expect(Number(updatedSource!.available_balance)).toBe(500); // 1000 - 500
    expect(Number(updatedSource!.total_balance)).toBe(500);
    expect(Number(updatedDest!.available_balance)).toBe(500);
    expect(Number(updatedDest!.total_balance)).toBe(500);
  });

  it('realiza transferência para conta de outro usuário', async () => {
    // Criar outro usuário
    const otherEmail = `receiver-transfer-${Date.now()}@example.com`;
    const otherUser = await prisma.user.create({
      data: { email: otherEmail, password_hash: 'test-hash', full_name: 'Receiver User' },
    });
    createdUserIds.push(otherUser.id);

    const otherAccount = await prisma.account.create({
      data: {
        user_id: otherUser.id,
        account_name: 'Conta Recebedora',
        account_type: 'checking',
        is_default: true,
        available_balance: 200,
        total_balance: 200,
      },
    });

    // Criar categoria de transferência
    await prisma.category.create({
      data: {
        name: 'Transferência',
        type: 'transfer',
        is_system: true,
      },
    });

    const amount = 300;
    const response = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId,
        destinationAccountId: otherAccount.id,
        amount,
        description: 'Pagamento',
      });

    expect(response.status).toBe(201);

    // Verificar saldos
    const updatedSource = await prisma.account.findUnique({ where: { id: sourceAccountId } });
    const updatedDest = await prisma.account.findUnique({ where: { id: otherAccount.id } });

    expect(Number(updatedSource!.available_balance)).toBe(700); // 1000 - 300
    expect(Number(updatedDest!.available_balance)).toBe(500); // 200 + 300
  });

  it('cria notificações para ambos os usuários na transferência', async () => {
    // Criar outro usuário
    const otherEmail = `notification-transfer-${Date.now()}@example.com`;
    const otherUser = await prisma.user.create({
      data: { email: otherEmail, password_hash: 'test-hash', full_name: 'Notification User' },
    });
    createdUserIds.push(otherUser.id);

    const otherAccount = await prisma.account.create({
      data: {
        user_id: otherUser.id,
        account_name: 'Conta Notificação',
        account_type: 'checking',
        is_default: true,
        available_balance: 0,
        total_balance: 0,
      },
    });

    // Criar categoria de transferência
    await prisma.category.create({
      data: {
        name: 'Transferência',
        type: 'transfer',
        is_system: true,
      },
    });

    await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId,
        destinationAccountId: otherAccount.id,
        amount: 200,
      });

    // Verificar notificações criadas
    const sourceNotifications = await prisma.notification.findMany({
      where: { user_id: userId },
    });
    const destNotifications = await prisma.notification.findMany({
      where: { user_id: otherUser.id },
    });

    expect(sourceNotifications.length).toBeGreaterThan(0);
    expect(destNotifications.length).toBeGreaterThan(0);
    expect(sourceNotifications[0].notification_type).toBe('transfer_sent');
    expect(destNotifications[0].notification_type).toBe('transfer_received');
  });
});
