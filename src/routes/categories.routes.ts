import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const categoryController = new CategoryController();

// Public endpoint - no authentication required for categories
router.get('/', (req, res, next) => {
  categoryController.list(req, res).catch(next);
});

// Protected endpoint - requires authentication to create a category
router.post('/', authenticate, (req, res, next) => {
  categoryController.create(req, res).catch(next);
});

export default router;
