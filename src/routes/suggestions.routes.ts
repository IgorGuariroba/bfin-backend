import { Router } from 'express';
import { SuggestionController } from '../controllers/SuggestionController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas de sugestão requerem autenticação
router.use(authenticate);

/**
 * @route GET /api/v1/suggestions/daily-limit
 * @desc Obtém o limite diário de gastos calculado
 * @query account_id - ID da conta
 * @access Private
 */
router.get('/daily-limit', SuggestionController.getDailyLimit);

/**
 * @route GET /api/v1/suggestions/status
 * @desc Obtém o status do limite (excedido ou não)
 * @query account_id - ID da conta
 * @access Private
 */
router.get('/status', SuggestionController.getStatus);

/**
 * @route GET /api/v1/suggestions/history
 * @desc Obtém o histórico de sugestões
 * @query account_id - ID da conta
 * @query limit - Limite de registros (padrão: 30)
 * @access Private
 */
router.get('/history', SuggestionController.getHistory);

/**
 * @route GET /api/v1/suggestions/spending-history
 * @desc Obtém o histórico de gastos diários com limite
 * @query account_id - ID da conta
 * @query days - Número de dias (padrão: 7, máx: 30)
 * @access Private
 */
router.get('/spending-history', SuggestionController.getSpendingHistory);

/**
 * @route POST /api/v1/suggestions/recalculate
 * @desc Força o recálculo do limite diário (invalida cache)
 * @query account_id - ID da conta
 * @access Private
 */
router.post('/recalculate', SuggestionController.recalculate);

export default router;
