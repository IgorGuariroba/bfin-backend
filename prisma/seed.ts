import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Deletar categorias existentes do sistema (se houver)
  await prisma.category.deleteMany({
    where: { is_system: true },
  });

  // Categorias de RECEITA
  const incomeCategories = [
    {
      name: 'Salário',
      type: 'income',
      color: '#4CAF50',
      icon: 'work',
      is_system: true,
    },
    {
      name: 'Freelance',
      type: 'income',
      color: '#8BC34A',
      icon: 'business',
      is_system: true,
    },
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

  // Categorias de DESPESA
  const expenseCategories = [
    {
      name: 'Moradia',
      type: 'expense',
      color: '#9C27B0',
      icon: 'home',
      is_system: true,
    },
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
    {
      name: 'Saúde',
      type: 'expense',
      color: '#F44336',
      icon: 'local_hospital',
      is_system: true,
    },
    {
      name: 'Educação',
      type: 'expense',
      color: '#3F51B5',
      icon: 'school',
      is_system: true,
    },
    {
      name: 'Lazer',
      type: 'expense',
      color: '#FF9800',
      icon: 'beach_access',
      is_system: true,
    },
    {
      name: 'Compras',
      type: 'expense',
      color: '#E91E63',
      icon: 'shopping_cart',
      is_system: true,
    },
    {
      name: 'Serviços',
      type: 'expense',
      color: '#795548',
      icon: 'build',
      is_system: true,
    },
    {
      name: 'Pets',
      type: 'expense',
      color: '#00BCD4',
      icon: 'pets',
      is_system: true,
    },
    {
      name: 'Outros',
      type: 'expense',
      color: '#607D8B',
      icon: 'more_horiz',
      is_system: true,
    },
  ];

  // Inserir categorias de receita
  for (const category of incomeCategories) {
    await prisma.category.create({
      data: category,
    });
  }

  console.log(`✅ ${incomeCategories.length} categorias de receita criadas`);

  // Inserir categorias de despesa
  for (const category of expenseCategories) {
    await prisma.category.create({
      data: category,
    });
  }

  console.log(`✅ ${expenseCategories.length} categorias de despesa criadas`);

  // Estatísticas finais
  const totalCategories = await prisma.category.count();
  console.log(`\n🎉 Seed concluído! Total de categorias: ${totalCategories}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
