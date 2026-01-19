import { Router } from 'express';
import { TransactionController } from '../controllers/TransactionController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const transactionController = new TransactionController();

// Todas as rotas de transações requerem autenticação
router.use(authenticate);

/**
 * @swagger
 * /api/v1/transactions/income:
 *   post:
 *     tags: [Transactions]
 *     summary: Criar receita
 *     description: Processa uma receita aplicando regras automáticas (30/70 - reserva de emergência e saldo disponível)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountId
 *               - amount
 *               - description
 *               - categoryId
 *             properties:
 *               accountId:
 *                 type: string
 *                 format: uuid
 *                 description: ID da conta
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *                 description: Valor da receita
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 description: Descrição da receita
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *                 description: ID da categoria
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Data de vencimento (opcional)
 *               isRecurring:
 *                 type: boolean
 *                 description: Indica se é uma receita recorrente
 *               recurrencePattern:
 *                 type: string
 *                 enum: [monthly, weekly, yearly]
 *                 description: Padrão de recorrência (opcional)
 *           example:
 *             accountId: "123e4567-e89b-12d3-a456-426614174000"
 *             amount: 5000.00
 *             description: "Salário mensal"
 *             categoryId: "123e4567-e89b-12d3-a456-426614174001"
 *             dueDate: "2024-01-15T00:00:00.000Z"
 *             isRecurring: true
 *             recurrencePattern: "monthly"
 *     responses:
 *       201:
 *         description: Receita criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso a esta conta
 *       404:
 *         description: Conta ou categoria não encontrada
 */
router.post('/income', (req, res, next) => {
  transactionController.createIncome(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/transactions/fixed-expense:
 *   post:
 *     tags: [Transactions]
 *     summary: Criar despesa fixa
 *     description: Cria uma despesa fixa com bloqueio preventivo do valor no saldo disponível
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountId
 *               - amount
 *               - description
 *               - categoryId
 *               - dueDate
 *             properties:
 *               accountId:
 *                 type: string
 *                 format: uuid
 *                 description: ID da conta
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *                 description: Valor da despesa
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 description: Descrição da despesa
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *                 description: ID da categoria
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Data de vencimento (obrigatório)
 *               isRecurring:
 *                 type: boolean
 *                 description: Indica se é uma despesa recorrente
 *               recurrencePattern:
 *                 type: string
 *                 enum: [monthly, weekly, yearly]
 *                 description: Padrão de recorrência (opcional)
 *           example:
 *             accountId: "123e4567-e89b-12d3-a456-426614174000"
 *             amount: 1500.00
 *             description: "Aluguel"
 *             categoryId: "123e4567-e89b-12d3-a456-426614174001"
 *             dueDate: "2024-01-10T00:00:00.000Z"
 *             isRecurring: true
 *             recurrencePattern: "monthly"
 *     responses:
 *       201:
 *         description: Despesa fixa criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso a esta conta
 *       404:
 *         description: Conta ou categoria não encontrada
 */
router.post('/fixed-expense', (req, res, next) => {
  transactionController.createFixedExpense(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/transactions/variable-expense:
 *   post:
 *     tags: [Transactions]
 *     summary: Criar despesa variável
 *     description: Cria uma despesa variável com débito imediato no saldo disponível
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountId
 *               - amount
 *               - description
 *               - categoryId
 *             properties:
 *               accountId:
 *                 type: string
 *                 format: uuid
 *                 description: ID da conta
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *                 description: Valor da despesa
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 description: Descrição da despesa
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *                 description: ID da categoria
 *           example:
 *             accountId: "123e4567-e89b-12d3-a456-426614174000"
 *             amount: 45.50
 *             description: "Supermercado"
 *             categoryId: "123e4567-e89b-12d3-a456-426614174001"
 *     responses:
 *       201:
 *         description: Despesa variável criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso a esta conta
 *       404:
 *         description: Conta ou categoria não encontrada
 */
router.post('/variable-expense', (req, res, next) => {
  transactionController.createVariableExpense(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/transactions:
 *   get:
 *     tags: [Transactions]
 *     summary: Listar transações
 *     description: Lista transações do usuário com filtros opcionais (conta, tipo, status, data, categoria, paginação)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: accountId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID da conta
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *         description: Tipos de transação separados por vírgula (income,fixed_expense,variable_expense)
 *       - in: query
 *         name: statuses
 *         schema:
 *           type: string
 *         description: Status das transações separados por vírgula (pending,overdue,paid,locked,cancelled)
 *       - in: query
 *         name: categories
 *         schema:
 *           type: string
 *         description: IDs das categorias separados por vírgula
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data inicial para filtrar transações
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data final para filtrar transações
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Limite de registros por página
 *     responses:
 *       200:
 *         description: Lista de transações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 total:
 *                   type: integer
 *                   description: Total de transações encontradas
 *                 page:
 *                   type: integer
 *                   description: Página atual
 *                 limit:
 *                   type: integer
 *                   description: Limite por página
 *       401:
 *         description: Não autenticado
 */
router.get('/', (req, res, next) => {
  transactionController.list(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/transactions/{id}:
 *   get:
 *     tags: [Transactions]
 *     summary: Obter transação por ID
 *     description: Retorna detalhes de uma transação específica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da transação
 *     responses:
 *       200:
 *         description: Detalhes da transação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso a esta transação
 *       404:
 *         description: Transação não encontrada
 */
router.get('/:id', (req, res, next) => {
  transactionController.getById(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/transactions/{id}:
 *   put:
 *     tags: [Transactions]
 *     summary: Atualizar transação
 *     description: Atualiza uma transação (apenas se estiver com status pending ou locked)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da transação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *                 description: Novo valor da transação (opcional)
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 description: Nova descrição (opcional)
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *                 description: Novo ID da categoria (opcional)
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Nova data de vencimento (opcional)
 *           example:
 *             amount: 2000.00
 *             description: "Aluguel atualizado"
 *             categoryId: "123e4567-e89b-12d3-a456-426614174001"
 *             dueDate: "2024-01-15T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: Transação atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transaction:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Dados inválidos ou transação não pode ser atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso a esta transação
 *       404:
 *         description: Transação não encontrada
 */
router.put('/:id', (req, res, next) => {
  transactionController.update(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/transactions/{id}/mark-as-paid:
 *   post:
 *     tags: [Transactions]
 *     summary: Marcar despesa fixa como paga
 *     description: Marca uma despesa fixa como paga, executando o pagamento e debitando o valor do saldo disponível
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da transação (deve ser uma despesa fixa)
 *     responses:
 *       200:
 *         description: Despesa marcada como paga com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transaction:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Transação não é uma despesa fixa ou já foi executada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso a esta transação
 *       404:
 *         description: Transação não encontrada
 */
router.post('/:id/mark-as-paid', (req, res, next) => {
  transactionController.markAsPaid(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/transactions/{id}/duplicate:
 *   post:
 *     tags: [Transactions]
 *     summary: Duplicar transação
 *     description: Cria uma nova transação com os mesmos dados da transação original (com descrição modificada)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da transação a ser duplicada
 *     responses:
 *       201:
 *         description: Transação duplicada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Transação não pode ser duplicada (sem categoria)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso a esta transação
 *       404:
 *         description: Transação não encontrada
 */
router.post('/:id/duplicate', (req, res, next) => {
  transactionController.duplicate(req, res).catch(next);
});

/**
 * @swagger
 * /api/v1/transactions/{id}:
 *   delete:
 *     tags: [Transactions]
 *     summary: Deletar transação
 *     description: Deleta uma transação (apenas se estiver com status pending ou locked)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da transação
 *     responses:
 *       200:
 *         description: Transação deletada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Transação não pode ser deletada (já executada)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem acesso a esta transação
 *       404:
 *         description: Transação não encontrada
 */
router.delete('/:id', (req, res, next) => {
  transactionController.delete(req, res).catch(next);
});

export default router;
