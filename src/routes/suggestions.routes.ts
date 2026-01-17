import { Router } from 'express';
import { SuggestionController } from '../controllers/SuggestionController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas de sugestão requerem autenticação
router.use(authenticate);

/**
 * @swagger
 * /api/v1/suggestions/daily-limit:
 *   get:
 *     tags: [Suggestions]
 *     summary: Obter limite diário de gastos
 *     description: Retorna o limite diário de gastos calculado para uma conta, incluindo informações sobre gastos do dia e status do limite
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: account_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da conta
 *     responses:
 *       200:
 *         description: Limite diário calculado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accountId:
 *                   type: string
 *                   format: uuid
 *                   description: ID da conta
 *                 dailyLimit:
 *                   type: number
 *                   format: decimal
 *                   description: Limite diário de gastos calculado
 *                 availableBalance:
 *                   type: number
 *                   format: decimal
 *                   description: Saldo disponível na conta
 *                 daysConsidered:
 *                   type: number
 *                   description: "Número de dias considerados no cálculo (padrão: 30)"
 *                 spentToday:
 *                   type: number
 *                   format: decimal
 *                   description: Valor já gasto hoje
 *                 remaining:
 *                   type: number
 *                   format: decimal
 *                   description: Valor restante do limite diário
 *                 percentageUsed:
 *                   type: number
 *                   format: decimal
 *                   description: Percentual do limite utilizado
 *                 exceeded:
 *                   type: boolean
 *                   description: Indica se o limite foi excedido
 *                 calculatedAt:
 *                   type: string
 *                   format: date-time
 *                   description: Data e hora do cálculo
 *             example:
 *               accountId: "123e4567-e89b-12d3-a456-426614174000"
 *               dailyLimit: 100.50
 *               availableBalance: 3015.00
 *               daysConsidered: 30
 *               spentToday: 45.25
 *               remaining: 55.25
 *               percentageUsed: 45.02
 *               exceeded: false
 *               calculatedAt: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: Parâmetro account_id é obrigatório
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Conta não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro ao calcular limite diário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
