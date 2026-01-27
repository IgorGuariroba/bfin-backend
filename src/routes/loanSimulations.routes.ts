import { Router } from 'express';
import { loanSimulationsController } from '../controllers/loanSimulations.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @swagger
 * /api/v1/loan-simulations:
 *   post:
 *     tags: [LoanSimulations]
 *     summary: Criar uma simulação de empréstimo com reserva
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, termMonths]
 *             properties:
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *               termMonths:
 *                 type: integer
 *                 minimum: 6
 *                 maximum: 30
 *               interestRateMonthly:
 *                 type: number
 *                 format: decimal
 *                 description: Opcional; padrão 0.025 (2.5% a.m.)
 *     responses:
 *       201:
 *         description: Simulação criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 amount:
 *                   type: number
 *                   format: decimal
 *                 termMonths:
 *                   type: integer
 *                 interestRateMonthly:
 *                   type: number
 *                   format: decimal
 *                 amortizationType:
 *                   type: string
 *                   enum: [PRICE]
 *                 installmentAmount:
 *                   type: number
 *                   format: decimal
 *                 totalInterest:
 *                   type: number
 *                   format: decimal
 *                 totalCost:
 *                   type: number
 *                   format: decimal
 *                 reserveUsagePercent:
 *                   type: number
 *                   format: decimal
 *                 reserveRemainingAmount:
 *                   type: number
 *                   format: decimal
 *                 monthlyCashflowImpact:
 *                   type: number
 *                   format: decimal
 *                 installmentPlan:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       installmentNumber:
 *                         type: integer
 *                       principalComponent:
 *                         type: number
 *                         format: decimal
 *                       interestComponent:
 *                         type: number
 *                         format: decimal
 *                       totalPayment:
 *                         type: number
 *                         format: decimal
 *                       remainingBalance:
 *                         type: number
 *                         format: decimal
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autenticado
 */
router.post('/', (req, res, next) => {
  loanSimulationsController.create(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/loan-simulations:
 *   get:
 *     tags: [LoanSimulations]
 *     summary: Listar simulações
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Lista de simulações
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   amount:
 *                     type: number
 *                     format: decimal
 *                   termMonths:
 *                     type: integer
 *                   interestRateMonthly:
 *                     type: number
 *                     format: decimal
 *                   installmentAmount:
 *                     type: number
 *                     format: decimal
 *       401:
 *         description: Não autenticado
 */
router.get('/', (req, res, next) => {
  loanSimulationsController.list(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/loan-simulations/{simulationId}:
 *   get:
 *     tags: [LoanSimulations]
 *     summary: Obter detalhes de uma simulação
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: simulationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes da simulação
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Simulação não encontrada
 */
router.get('/:simulationId', (req, res, next) => {
  loanSimulationsController.getById(req, res).catch(next);
});

export default router;
