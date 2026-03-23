import { withAuth } from '../middlewares/withAuth';
import { CashFlowProjectionService } from '../services/CashFlowProjectionService';
import { monthlyProjectionSchema } from '../validators/cashFlowSchemas';

const cashFlowProjectionService = new CashFlowProjectionService();

export class CashFlowController {
  /**
   * GET /api/v1/cash-flow/monthly
   * Projeção de saldo dia a dia para um mês (passado, atual ou futuro)
   */
  getMonthlyProjection = withAuth(async (req, res): Promise<void> => {
    const { accountId, year, month } = monthlyProjectionSchema.parse(req.query);
    const result = await cashFlowProjectionService.getMonthlyProjection(
      req.user.userId,
      accountId,
      year,
      month
    );
    res.json(result);
  });
}
