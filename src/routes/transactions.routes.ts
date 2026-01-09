import { Router } from 'express';
import { TransactionController } from '../controllers/TransactionController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const transactionController = new TransactionController();

// Todas as rotas de transações requerem autenticação
router.use(authenticate);

// Criar transações por tipo
router.post('/income', (req, res, next) => {
  transactionController.createIncome(req, res).catch(next);
});

router.post('/fixed-expense', (req, res, next) => {
  transactionController.createFixedExpense(req, res).catch(next);
});

router.post('/variable-expense', (req, res, next) => {
  transactionController.createVariableExpense(req, res).catch(next);
});

// Listar e buscar transações
router.get('/', (req, res, next) => {
  transactionController.list(req, res).catch(next);
});

router.get('/:id', (req, res, next) => {
  transactionController.getById(req, res).catch(next);
});

// Marcar despesa fixa como paga
router.post('/:id/mark-as-paid', (req, res, next) => {
  transactionController.markAsPaid(req, res).catch(next);
});

// Duplicar transação
router.post('/:id/duplicate', (req, res, next) => {
  transactionController.duplicate(req, res).catch(next);
});

// Atualizar transação
router.put('/:id', (req, res, next) => {
  transactionController.update(req, res).catch(next);
});

// Deletar transação
router.delete('/:id', (req, res, next) => {
  transactionController.delete(req, res).catch(next);
});

export default router;
