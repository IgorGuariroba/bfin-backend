import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';
import { authenticate, optionalAuthenticate } from '../middlewares/auth';

const router = Router();
const categoryController = new CategoryController();

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     tags: [Categories]
 *     summary: Listar categorias
 *     description: Retorna lista de categorias. Se account_id for fornecido, retorna categorias do sistema + categorias da conta.
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *         description: Filtrar por tipo de categoria
 *       - in: query
 *         name: account_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da conta para buscar categorias personalizadas (requer autenticação)
 *     responses:
 *       200:
 *         description: Lista de categorias
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *       403:
 *         description: Sem acesso à conta especificada
 */
// Public endpoint (if account_id not provided) - checks auth inside controller if needed
router.get('/', optionalAuthenticate, (req, res, next) => {
  categoryController.list(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: Obter categoria por ID
 *     description: Retorna detalhes de uma categoria específica
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da categoria
 *     responses:
 *       200:
 *         description: Detalhes da categoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       403:
 *         description: Sem acesso à categoria
 *       404:
 *         description: Categoria não encontrada
 */
router.get('/:id', optionalAuthenticate, (req, res, next) => {
  categoryController.getById(req, res).catch(next);
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

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   patch:
 *     tags: [Categories]
 *     summary: Atualizar categoria
 *     description: Atualiza uma categoria personalizada (não funciona para categorias do sistema)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da categoria
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *     responses:
 *       200:
 *         description: Categoria atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       403:
 *         description: Sem permissão ou categoria do sistema
 *       404:
 *         description: Categoria não encontrada
 */
router.patch('/:id', authenticate, (req, res, next) => {
  categoryController.update(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   delete:
 *     tags: [Categories]
 *     summary: Deletar categoria
 *     description: Deleta uma categoria personalizada (não funciona para categorias do sistema)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da categoria
 *     responses:
 *       200:
 *         description: Categoria deletada com sucesso
 *       403:
 *         description: Sem permissão ou categoria do sistema
 *       404:
 *         description: Categoria não encontrada
 */
router.delete('/:id', authenticate, (req, res, next) => {
  categoryController.delete(req, res).catch(next);
});

export default router;
