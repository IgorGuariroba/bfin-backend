import 'dotenv/config';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../lib/prisma';

beforeAll(async () => {
  // Setup: garantir que o banco está conectado
  await prisma.$connect();
});

afterAll(async () => {
  // Cleanup: desconectar do banco
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Limpar dados antes de cada teste
  await cleanDatabase();
});

async function cleanDatabase() {
  // Deletar em ordem devido às foreign keys
  await prisma.notification.deleteMany();
  await prisma.balanceHistory.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.spendingSuggestion.deleteMany();
  await prisma.financialRule.deleteMany();
  await prisma.accountInvitation.deleteMany();
  await prisma.accountMember.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}
