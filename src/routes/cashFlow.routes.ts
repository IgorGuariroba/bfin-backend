import { Router } from 'express';
import { CashFlowController } from '../controllers/CashFlowController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const cashFlowController = new CashFlowController();

router.use(authenticate);

/**
 * @swagger
 * /api/v1/cash-flow/monthly:
 *   get:
 *     tags: [CashFlow]
 *     summary: Projeção de saldo mensal dia a dia
 *     description: |
 *       Retorna o saldo projetado para cada dia do mês informado.
 *
 *       - **Mês passado**: reconstruído a partir do histórico real (balance_history)
 *       - **Mês atual**: dias passados = histórico real, dias futuros = projeção
 *       - **Mês futuro**: simulação completa a partir do saldo atual
 *
 *       **Algoritmo por dia:**
 *       1. Aplica receitas pendentes com vencimento neste dia
 *       2. Aplica despesas pendentes com vencimento neste dia
 *       3. Se sobrou saldo positivo e há dívidas flutuantes:
 *          abate `min(saldo, dívida)` — nunca mais do que o disponível
 *
 *       **Dívidas flutuantes** são despesas criadas com `isFloating: true` (sem data de vencimento).
 *       Elas aparecem em `totalFloatingDebt` e são abatidas automaticamente no dia em que
 *       houver excedente, até zerarem.
 *
 *       **Receitas recorrentes** agendadas (criadas com `isRecurring: true` e data futura)
 *       geram instâncias pendentes automaticamente e aparecem na projeção.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           example: 2026
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           example: 12
 *     responses:
 *       200:
 *         description: Projeção mensal dia a dia
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accountId:
 *                   type: string
 *                 year:
 *                   type: integer
 *                 month:
 *                   type: integer
 *                 startBalance:
 *                   type: number
 *                   description: Saldo no início do mês
 *                 endBalance:
 *                   type: number
 *                   description: Saldo no fim do mês
 *                 totalFloatingDebt:
 *                   type: number
 *                   description: Total de dívidas sem data de vencimento
 *                 remainingFloatingDebtAtEnd:
 *                   type: number
 *                   description: Dívida flutuante restante ao final do mês
 *                 debtFreeDate:
 *                   type: string
 *                   nullable: true
 *                   description: Data em que todas as dívidas flutuantes serão quitadas (null se não ocorrer neste mês)
 *                 isHistorical:
 *                   type: boolean
 *                 days:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         example: "2026-12-15"
 *                       balance:
 *                         type: number
 *                         description: Saldo ao final do dia (negativo = endividado)
 *                       remainingFloatingDebt:
 *                         type: number
 *                       isNegative:
 *                         type: boolean
 *                       dailyIncome:
 *                         type: number
 *                       dailyExpenses:
 *                         type: number
 *                       floatingDebtPayment:
 *                         type: number
 *                         description: Valor abatido na dívida flutuante neste dia
 *                       transactions:
 *                         type: array
 */
router.get('/monthly', (req, res, next) => {
  cashFlowController.getMonthlyProjection(req, res).catch(next);
});

export default router;
