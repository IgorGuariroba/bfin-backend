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
 *     summary: Listar simulações com filtro de status
 *     description: Retorna lista paginada de simulações do usuário, opcionalmente filtrada por status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Número máximo de resultados
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Número de resultados a pular
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, COMPLETED]
 *         description: Filtrar por status da simulação (opcional)
 *     responses:
 *       200:
 *         description: Lista de simulações ordenada por data de criação (mais recente primeiro)
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
 *                   status:
 *                     type: string
 *                     enum: [PENDING, APPROVED, COMPLETED]
 *                   approvedAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   withdrawnAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *       400:
 *         description: Erro de validação (status inválido)
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
 *     summary: Obter detalhes completos de uma simulação
 *     description: Retorna todos os detalhes incluindo plano de parcelas e informações de status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: simulationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da simulação
 *     responses:
 *       200:
 *         description: Detalhes completos da simulação
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
 *                 status:
 *                   type: string
 *                   enum: [PENDING, APPROVED, COMPLETED]
 *                 approvedAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 withdrawnAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 installmentPlan:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Simulação não encontrada
 */
router.get('/:simulationId', (req, res, next) => {
  loanSimulationsController.getById(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/loan-simulations/{id}/approve:
 *   post:
 *     tags: [LoanSimulations]
 *     summary: Aprovar uma simulação de empréstimo
 *     description: Aprova uma simulação existente, validando status PENDING, expiração de 30 dias e limite de 70% da reserva
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da simulação a ser aprovada
 *     responses:
 *       200:
 *         description: Simulação aprovada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 simulation:
 *                   type: object
 *                   description: Detalhes completos da simulação aprovada
 *                 message:
 *                   type: string
 *                   example: Loan simulation approved successfully
 *       400:
 *         description: Erro de validação (status inválido, expirada, excede limite de 70%)
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Simulação não encontrada
 */
router.post('/:id/approve', (req, res, next) => {
  loanSimulationsController.approve(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/loan-simulations/{id}/withdraw:
 *   post:
 *     tags: [LoanSimulations]
 *     summary: Retirar fundos da reserva de emergência
 *     description: Executa a retirada de fundos da reserva de emergência para o saldo disponível após aprovação da simulação
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da simulação aprovada para retirada
 *     responses:
 *       200:
 *         description: Fundos retirados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 simulation:
 *                   type: object
 *                   description: Detalhes completos da simulação concluída
 *                 balances:
 *                   type: object
 *                   properties:
 *                     emergencyReserveBefore:
 *                       type: number
 *                       format: decimal
 *                       description: Saldo da reserva antes da retirada
 *                     emergencyReserveAfter:
 *                       type: number
 *                       format: decimal
 *                       description: Saldo da reserva após a retirada
 *                     availableBalanceBefore:
 *                       type: number
 *                       format: decimal
 *                       description: Saldo disponível antes da retirada
 *                     availableBalanceAfter:
 *                       type: number
 *                       format: decimal
 *                       description: Saldo disponível após a retirada
 *                 message:
 *                   type: string
 *                   example: Funds withdrawn successfully from emergency reserve
 *       400:
 *         description: Erro de validação (status não é APPROVED, reserva insuficiente, excede limite de 70%)
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Simulação não encontrada
 */
router.post('/:id/withdraw', (req, res, next) => {
  loanSimulationsController.withdraw(req, res).catch(next);
});

export default router;
