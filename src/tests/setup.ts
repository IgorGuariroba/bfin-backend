import 'dotenv/config';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../lib/prisma';

const skipDbSetup = process.env.SKIP_DB_SETUP === 'true';

async function cleanDatabase() {
  // Deletar em ordem devido às foreign keys
  // Manter categorias do sistema (is_system: true)
  await prisma.notification.deleteMany();
  await prisma.balanceHistory.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany({ where: { is_system: false } }); // Manter categorias do sistema
  await prisma.spendingSuggestion.deleteMany();
  await prisma.financialRule.deleteMany();
  await prisma.accountInvitation.deleteMany();
  await prisma.accountMember.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

if (!skipDbSetup) {
  beforeAll(async () => {
    // Setup: garantir que o banco está conectado
    await prisma.$connect();

    // Garantir que as categorias do sistema existem
    await prisma.category.deleteMany({ where: { is_system: true } });

    // Criar categoria de transferência
    await prisma.category.create({
      data: {
        name: 'Transferências',
        type: 'transfer',
        color: '#9E9E9E',
        icon: 'swap_horiz',
        is_system: true,
      },
    });

    // Criar categorias de receita
    const incomeCategories = [
      { name: 'Salário', type: 'income', color: '#4CAF50', icon: 'work', is_system: true },
      { name: 'Freelance', type: 'income', color: '#8BC34A', icon: 'business', is_system: true },
      {
        name: 'Investimentos',
        type: 'income',
        color: '#CDDC39',
        icon: 'trending_up',
        is_system: true,
      },
      {
        name: 'Rendas Extras',
        type: 'income',
        color: '#66BB6A',
        icon: 'attach_money',
        is_system: true,
      },
    ];

    for (const category of incomeCategories) {
      await prisma.category.create({ data: category });
    }

    // Criar categorias de despesa
    const expenseCategories = [
      { name: 'Moradia', type: 'expense', color: '#9C27B0', icon: 'home', is_system: true },
      {
        name: 'Alimentação',
        type: 'expense',
        color: '#FF5722',
        icon: 'restaurant',
        is_system: true,
      },
      {
        name: 'Transporte',
        type: 'expense',
        color: '#2196F3',
        icon: 'directions_car',
        is_system: true,
      },
      { name: 'Saúde', type: 'expense', color: '#F44336', icon: 'local_hospital', is_system: true },
      { name: 'Educação', type: 'expense', color: '#3F51B5', icon: 'school', is_system: true },
      { name: 'Lazer', type: 'expense', color: '#FF9800', icon: 'beach_access', is_system: true },
      {
        name: 'Compras',
        type: 'expense',
        color: '#E91E63',
        icon: 'shopping_cart',
        is_system: true,
      },
      { name: 'Serviços', type: 'expense', color: '#795548', icon: 'build', is_system: true },
      { name: 'Pets', type: 'expense', color: '#00BCD4', icon: 'pets', is_system: true },
      { name: 'Outros', type: 'expense', color: '#607D8B', icon: 'more_horiz', is_system: true },
    ];

    for (const category of expenseCategories) {
      await prisma.category.create({ data: category });
    }
  });

  afterAll(async () => {
    // Cleanup: desconectar do banco
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Limpar dados antes de cada teste
    await cleanDatabase();
  });
}
