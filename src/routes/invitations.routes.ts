import { Router } from 'express';
import { AccountMemberController } from '../controllers/AccountMemberController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const accountMemberController = new AccountMemberController();

// Todas as rotas de convites requerem autenticação
router.use(authenticate);

// Lista convites recebidos pelo usuário logado
router.get('/my-invitations', (req, res, next) => {
  accountMemberController.listMyInvitations(req, res).catch(next);
});

// Aceita um convite
router.post('/:token/accept', (req, res, next) => {
  accountMemberController.acceptInvitation(req, res).catch(next);
});

// Rejeita um convite
router.post('/:token/reject', (req, res, next) => {
  accountMemberController.rejectInvitation(req, res).catch(next);
});

export default router;
