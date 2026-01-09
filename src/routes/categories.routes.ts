import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';

const router = Router();
const categoryController = new CategoryController();

// Public endpoint - no authentication required for categories
router.get('/', (req, res, next) => {
  categoryController.list(req, res).catch(next);
});

export default router;
