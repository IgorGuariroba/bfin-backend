import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middlewares/auth';
import { authRateLimiter } from '../middlewares/rateLimit';

const router = Router();
const authController = new AuthController();

// Rotas públicas (com rate limiting mais restritivo)
router.post('/register', authRateLimiter, (req, res, next) => {
  authController.register(req, res).catch(next);
});

router.post('/login', authRateLimiter, (req, res, next) => {
  authController.login(req, res).catch(next);
});

router.post('/refresh', (req, res, next) => {
  authController.refresh(req, res).catch(next);
});

// Rotas protegidas
router.get('/me', authenticate, (req, res, next) => {
  authController.me(req, res).catch(next);
});

export default router;
