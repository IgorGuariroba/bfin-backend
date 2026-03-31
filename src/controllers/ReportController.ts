import { withAuth } from '../middlewares/withAuth';
import { ReportService } from '../services/ReportService';
import { monthlySummarySchema } from '../validators/reportSchemas';

const reportService = new ReportService();

export class ReportController {
  getMonthlySummary = withAuth(async (req, res): Promise<void> => {
    const { month, year } = monthlySummarySchema.parse(req.query);
    const result = await reportService.getMonthlySummary(req.user.userId, month, year);
    res.json(result);
  });
}
