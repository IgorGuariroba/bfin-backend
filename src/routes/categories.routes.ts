import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const categoryController = new CategoryController();

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     tags: [Categories]
 *     summary: Listar categorias
 *     description: Retorna lista de categorias do sistema (públicas)
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *         description: Filtrar por tipo de categoria
 *     responses:
 *       200:
 *         description: Lista de categorias
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 */
// Public endpoint - no authentication required for categories
router.get('/', (req, res, next) => {
  categoryController.list(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/categories:
 *   post:
 *     tags: [Categories]
 *     summary: Criar nova categoria
 *     description: Cria uma categoria personalizada associada a uma conta
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - account_id
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alimentação
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *                 example: expense
 *               account_id:
 *                 type: string
 *                 format: uuid
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *               color:
 *                 type: string
 *                 example: "#FF5733"
 *               icon:
 *                 type: string
 *                 example: "🍔"
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso à conta especificada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Protected endpoint - requires authentication to create a category
router.post('/', authenticate, (req, res, next) => {
  categoryController.create(req, res).catch(next);
});

export default router;
