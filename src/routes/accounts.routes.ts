import { Router } from 'express';
import { AccountController } from '../controllers/AccountController';
import { AccountMemberController } from '../controllers/AccountMemberController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const accountController = new AccountController();
const accountMemberController = new AccountMemberController();

// Todas as rotas de contas requerem autenticação
router.use(authenticate);

/**
 * @swagger
 * /api/v1/accounts:
 *   get:
 *     tags: [Accounts]
 *     summary: Listar contas do usuário
 *     description: Retorna todas as contas do usuário (próprias e compartilhadas)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de contas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Account'
 *       401:
 *         description: Não autenticado
 */
router.get('/', (req, res, next) => {
  accountController.list(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/accounts/{id}:
 *   get:
 *     tags: [Accounts]
 *     summary: Obter conta por ID
 *     description: Retorna detalhes de uma conta específica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da conta
 *     responses:
 *       200:
 *         description: Detalhes da conta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso a esta conta
 *       404:
 *         description: Conta não encontrada
 */
router.get('/:id', (req, res, next) => {
  accountController.getById(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/accounts:
 *   post:
 *     tags: [Accounts]
 *     summary: Criar nova conta
 *     description: Cria uma nova conta financeira para o usuário
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - account_name
 *             properties:
 *               account_name:
 *                 type: string
 *                 example: Conta Corrente Principal
 *               account_type:
 *                 type: string
 *                 enum: [checking, savings, investment]
 *                 default: checking
 *                 example: checking
 *               is_default:
 *                 type: boolean
 *                 default: false
 *                 example: true
 *     responses:
 *       201:
 *         description: Conta criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 */
router.post('/', (req, res, next) => {
  accountController.create(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/accounts/{id}:
 *   patch:
 *     tags: [Accounts]
 *     summary: Atualizar conta
 *     description: Atualiza informações de uma conta existente (apenas owner)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da conta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account_name:
 *                 type: string
 *                 example: Conta Atualizada
 *               is_default:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Conta atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Apenas owners podem atualizar a conta
 *       404:
 *         description: Conta não encontrada
 */
router.patch('/:id', (req, res, next) => {
  accountController.update(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/accounts/{id}:
 *   delete:
 *     tags: [Accounts]
 *     summary: Deletar conta
 *     description: Deleta uma conta (apenas se não tiver transações)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da conta
 *     responses:
 *       200:
 *         description: Conta deletada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account deleted successfully
 *       400:
 *         description: Conta possui transações ou saldo não-zero
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Apenas owners podem deletar a conta
 *       404:
 *         description: Conta não encontrada
 */
router.delete('/:id', (req, res, next) => {
  accountController.delete(req, res).catch(next);
});

// Rotas de membros de contas
router.get('/:accountId/members', (req, res, next) => {
  accountMemberController.listMembers(req, res).catch(next);
});

router.put('/:accountId/members/:userId', (req, res, next) => {
  accountMemberController.updateMemberRole(req, res).catch(next);
});

router.delete('/:accountId/members/:userId', (req, res, next) => {
  accountMemberController.removeMember(req, res).catch(next);
});

// Rotas de convites de contas
router.post('/:accountId/invitations', (req, res, next) => {
  accountMemberController.createInvitation(req, res).catch(next);
});

router.get('/:accountId/invitations', (req, res, next) => {
  accountMemberController.listInvitations(req, res).catch(next);
});

export default router;
