import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const reportController = new ReportController();

router.use(authenticate);

router.get('/monthly-summary', (req, res, next) => {
  reportController.getMonthlySummary(req, res).catch(next);
});

export default router;
