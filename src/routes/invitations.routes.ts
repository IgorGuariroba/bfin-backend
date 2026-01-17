import { Router } from 'express';
import { AccountMemberController } from '../controllers/AccountMemberController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const accountMemberController = new AccountMemberController();

// Todas as rotas de convites requerem autenticação
router.use(authenticate);

/**
 * @swagger
 * /api/v1/invitations/my-invitations:
 *   get:
 *     tags: [Invitations]
 *     summary: Listar convites recebidos
 *     description: Retorna todos os convites pendentes recebidos pelo usuário logado (não expirados)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de convites recebidos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                     description: ID do convite
 *                   token:
 *                     type: string
 *                     description: Token único do convite
 *                   account_id:
 *                     type: string
 *                     format: uuid
 *                     description: ID da conta
 *                   invited_email:
 *                     type: string
 *                     format: email
 *                     description: Email do usuário convidado
 *                   role:
 *                     type: string
 *                     enum: [owner, member, viewer]
 *                     description: Papel do usuário na conta
 *                   status:
 *                     type: string
 *                     enum: [pending, accepted, rejected]
 *                     description: Status do convite
 *                   expires_at:
 *                     type: string
 *                     format: date-time
 *                     description: Data de expiração do convite
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     description: Data de criação do convite
 *                   account:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       account_name:
 *                         type: string
 *                   inviter:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       email:
 *                         type: string
 *                         format: email
 *                       full_name:
 *                         type: string
 *             example:
 *               - id: "123e4567-e89b-12d3-a456-426614174000"
 *                 token: "abc123def456"
 *                 account_id: "123e4567-e89b-12d3-a456-426614174001"
 *                 invited_email: "usuario@example.com"
 *                 role: "member"
 *                 status: "pending"
 *                 expires_at: "2024-02-01T00:00:00.000Z"
 *                 created_at: "2024-01-15T10:00:00.000Z"
 *                 account:
 *                   id: "123e4567-e89b-12d3-a456-426614174001"
 *                   account_name: "Conta Compartilhada"
 *                 inviter:
 *                   id: "123e4567-e89b-12d3-a456-426614174002"
 *                   email: "dono@example.com"
 *                   full_name: "João Silva"
 *       401:
 *         description: Não autenticado
 */
router.get('/my-invitations', (req, res, next) => {
  accountMemberController.listMyInvitations(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/invitations/{token}/accept:
 *   post:
 *     tags: [Invitations]
 *     summary: Aceitar convite
 *     description: Aceita um convite para participar de uma conta compartilhada. O usuário deve ser o destinatário do convite e o convite deve estar pendente e não expirado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token único do convite
 *     responses:
 *       200:
 *         description: Convite aceito com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   description: ID do membro criado
 *                 account_id:
 *                   type: string
 *                   format: uuid
 *                   description: ID da conta
 *                 user_id:
 *                   type: string
 *                   format: uuid
 *                   description: ID do usuário
 *                 role:
 *                   type: string
 *                   enum: [owner, member, viewer]
 *                   description: Papel do usuário na conta
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: Data de criação do membro
 *                 account:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     account_name:
 *                       type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                       format: email
 *                     full_name:
 *                       type: string
 *             example:
 *               id: "123e4567-e89b-12d3-a456-426614174003"
 *               account_id: "123e4567-e89b-12d3-a456-426614174001"
 *               user_id: "123e4567-e89b-12d3-a456-426614174004"
 *               role: "member"
 *               created_at: "2024-01-15T10:30:00.000Z"
 *               account:
 *                 id: "123e4567-e89b-12d3-a456-426614174001"
 *                 account_name: "Conta Compartilhada"
 *               user:
 *                 id: "123e4567-e89b-12d3-a456-426614174004"
 *                 email: "usuario@example.com"
 *                 full_name: "Maria Santos"
 *       400:
 *         description: Convite já foi processado ou expirou
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Usuário não autorizado a aceitar este convite ou já é membro da conta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Convite não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:token/accept', (req, res, next) => {
  accountMemberController.acceptInvitation(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/invitations/{token}/reject:
 *   post:
 *     tags: [Invitations]
 *     summary: Rejeitar convite
 *     description: Rejeita um convite para participar de uma conta compartilhada. O usuário deve ser o destinatário do convite e o convite deve estar pendente e não expirado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token único do convite
 *     responses:
 *       200:
 *         description: Convite rejeitado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation rejected successfully"
 *                 invitation:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     token:
 *                       type: string
 *                     account_id:
 *                       type: string
 *                       format: uuid
 *                     invited_email:
 *                       type: string
 *                       format: email
 *                     role:
 *                       type: string
 *                       enum: [owner, member, viewer]
 *                     status:
 *                       type: string
 *                       enum: [pending, accepted, rejected]
 *                       example: "rejected"
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *             example:
 *               message: "Invitation rejected successfully"
 *               invitation:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 token: "abc123def456"
 *                 account_id: "123e4567-e89b-12d3-a456-426614174001"
 *                 invited_email: "usuario@example.com"
 *                 role: "member"
 *                 status: "rejected"
 *                 expires_at: "2024-02-01T00:00:00.000Z"
 *                 created_at: "2024-01-15T10:00:00.000Z"
 *                 updated_at: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: Convite já foi processado ou expirou
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Usuário não autorizado a rejeitar este convite
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Convite não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:token/reject', (req, res, next) => {
  accountMemberController.rejectInvitation(req, res).catch(next);
});

export default router;
