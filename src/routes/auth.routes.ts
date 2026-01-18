import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middlewares/auth';
import { authRateLimiter } from '../middlewares/rateLimit';

const router = Router();
const authController = new AuthController();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Registrar novo usuário
 *     description: Cria uma nova conta de usuário no sistema
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - full_name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@gmail.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: 123456
 *               full_name:
 *                 type: string
 *                 example: João Silva
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *                     expires_in:
 *                       type: number
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email já cadastrado
 */
// Rotas públicas (com rate limiting mais restritivo)
router.post('/register', authRateLimiter, (req, res, next) => {
  authController.register(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Fazer login
 *     description: Autentica um usuário e retorna tokens de acesso
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@gmail.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *                     expires_in:
 *                       type: number
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', authRateLimiter, (req, res, next) => {
  authController.login(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Renovar token de acesso
 *     description: Gera um novo access token usando o refresh token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 expires_in:
 *                   type: number
 *       401:
 *         description: Refresh token inválido ou expirado
 */
router.post('/refresh', (req, res, next) => {
  authController.refresh(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Obter dados do usuário autenticado
 *     description: Retorna as informações do usuário atualmente autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Token inválido ou não fornecido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Rotas protegidas
router.get('/me', authenticate, (req, res, next) => {
  authController.me(req, res).catch(next);
});

export default router;
