import prisma from '../lib/prisma';

export interface CategoryExpenseSummary {
  categoryId: string;
  categoryName: string;
  total: number;
  percentage: number;
}

export interface MonthlySummary {
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  expensesByCategory: CategoryExpenseSummary[];
}

export class ReportService {
  async getMonthlySummary(userId: string, month: number, year: number): Promise<MonthlySummary> {
    const accounts = await prisma.account.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const transactions = await prisma.transaction.findMany({
      where: {
        account_id: { in: accountIds },
        status: 'executed',
        executed_date: { gte: startDate, lt: endDate },
      },
      include: { category: true },
    });

    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenseTransactions = transactions.filter((t) => t.type !== 'income');
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

    const categoryTotals = new Map<string, { categoryName: string; total: number }>();
    for (const tx of expenseTransactions) {
      if (!tx.category_id || !tx.category) {
        continue;
      }
      const existing = categoryTotals.get(tx.category_id);
      if (existing) {
        existing.total += Number(tx.amount);
      } else {
        categoryTotals.set(tx.category_id, {
          categoryName: tx.category.name,
          total: Number(tx.amount),
        });
      }
    }

    const expensesByCategory: CategoryExpenseSummary[] = Array.from(categoryTotals.entries()).map(
      ([categoryId, { categoryName, total }]) => ({
        categoryId,
        categoryName,
        total,
        percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
      })
    );

    return {
      month,
      year,
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      expensesByCategory,
    };
  }
}
