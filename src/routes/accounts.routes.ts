import { Router } from 'express';
import { AccountController } from '../controllers/AccountController';
import { AccountMemberController } from '../controllers/AccountMemberController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const accountController = new AccountController();
const accountMemberController = new AccountMemberController();

// Todas as rotas de contas requerem autenticação
router.use(authenticate);

router.get('/', (req, res, next) => {
  accountController.list(req, res).catch(next);
});

router.get('/:id', (req, res, next) => {
  accountController.getById(req, res).catch(next);
});

router.post('/', (req, res, next) => {
  accountController.create(req, res).catch(next);
});

router.patch('/:id', (req, res, next) => {
  accountController.update(req, res).catch(next);
});

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
