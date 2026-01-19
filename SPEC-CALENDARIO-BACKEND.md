# 📅 Especificação Backend - Calendário BFIN

## 📋 Visão Geral

Esta especificação detalha os requisitos do backend para suportar o **Calendário de Contas BFIN** implementado no frontend. O calendário exibe transações organizadas por data de vencimento com filtros avançados e estados visuais.

**Status**: Especificação Técnica
**Versão**: 1.0
**Data**: Janeiro 2026
**Frontend Implementado**: ✅ Completo
**Backend Requerido**: ❌ Pendente

---

## 🎯 Funcionalidades Requeridas

### Core Features
- ✅ **Visualização mensal** de vencimentos de contas
- ✅ **Sistema de cores** por status (pago, vencendo, vencido)
- ✅ **Filtros avançados** por categoria, tipo e status
- ✅ **Navegação temporal** entre meses/períodos
- ✅ **Responsividade** completa
- ✅ **Performance otimizada** com cache

### Integração Requerida
- 🔄 **API REST** para consulta de transações
- 🔄 **Filtros dinâmicos** via query parameters
- 🔄 **Paginação** para grandes volumes
- 🔄 **Cache inteligente** para performance
- 🔄 **Índices de banco** otimizados

---

## 📊 Análise do Frontend

### Hook Principal: useCalendar

O frontend utiliza o seguinte hook que define os requisitos da API:

```typescript
// src/hooks/useCalendar.ts
const { data: events = [], isLoading, error, refetch } = useQuery({
  queryKey: [
    'calendar-events',
    format(currentDate, 'yyyy-MM'),
    filters
  ],
  queryFn: async () => {
    const startDate = startOfMonth(currentDate)
    const endDate = endOfMonth(currentDate)

    const response = await transactionService.list({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      ...filters
    })

    return transformTransactionsToEvents(response.transactions, currentDate)
  },
  staleTime: 1000 * 60 * 5, // 5 minutos
  gcTime: 1000 * 60 * 30,   // 30 minutos
})
```

### Filtros Utilizados

```typescript
// Filtros aplicados pelo frontend
interface CalendarFilters {
  types?: Array<'income' | 'fixed_expense' | 'variable_expense'>
  categories?: string[]
  statuses?: Array<'pending' | 'paid' | 'overdue'>
  accountId?: string
}
```

### Transformação de Dados

```typescript
// Como o frontend processa os dados do backend
function transformTransactionsToEvents(transactions: Transaction[]): CalendarEvent[] {
  return transactions.map(transaction => ({
    id: transaction.id,
    date: format(new Date(transaction.due_date), 'yyyy-MM-dd'),
    transaction,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    category: transaction.category?.name || 'Sem categoria',
    status: getTransactionStatus(transaction), // pending | paid | overdue
    isRecurring: transaction.is_recurring || false,
    daysUntilDue: getDaysUntilDue(transaction.due_date),
    displayColor: getEventColor(transaction),
  }))
}

// Cálculo de status baseado em regras de negócio
function getTransactionStatus(transaction: Transaction): 'pending' | 'paid' | 'overdue' {
  if (transaction.status === 'executed' || transaction.executed_date) return 'paid'
  if (transaction.status === 'cancelled') return 'pending'
  if (new Date(transaction.due_date) < new Date()) return 'overdue'
  return 'pending'
}
```

---

## 🛠 Especificação da API

### 1. Endpoint Principal

**GET** `/api/v1/transactions`

#### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `startDate` | string | ✅ | Data início (ISO) | `2026-01-01` |
| `endDate` | string | ✅ | Data fim (ISO) | `2026-01-31` |
| `types` | string[] | ❌ | Tipos de transação | `income,fixed_expense` |
| `statuses` | string[] | ❌ | Status das transações | `pending,overdue` |
| `categories` | string[] | ❌ | IDs das categorias | `cat1,cat2,cat3` |
| `accountId` | string | ❌ | ID da conta específica | `acc_123` |
| `page` | number | ❌ | Página (paginação) | `1` |
| `limit` | number | ❌ | Itens por página | `100` |

#### Exemplo de Requisição

```http
GET /api/v1/transactions?startDate=2026-01-01&endDate=2026-01-31&types=income,fixed_expense&statuses=pending,overdue&accountId=acc_123&limit=100
Authorization: Bearer <token>
Content-Type: application/json
```

#### Response Format

```json
{
  "transactions": [
    {
      "id": "txn_123",
      "due_date": "2026-01-15T00:00:00.000Z",
      "type": "fixed_expense",
      "amount": 1500.00,
      "description": "Aluguel Apartamento",
      "status": "pending",
      "executed_date": null,
      "is_recurring": true,
      "category": {
        "id": "cat_housing",
        "name": "Habitação"
      },
      "account": {
        "id": "acc_123",
        "name": "Conta Corrente"
      },
      "created_at": "2026-01-01T10:00:00.000Z",
      "updated_at": "2026-01-10T15:30:00.000Z"
    },
    {
      "id": "txn_124",
      "due_date": "2026-01-20T00:00:00.000Z",
      "type": "income",
      "amount": 5000.00,
      "description": "Salário Janeiro",
      "status": "executed",
      "executed_date": "2026-01-20T09:15:00.000Z",
      "is_recurring": true,
      "category": {
        "id": "cat_salary",
        "name": "Salário"
      },
      "account": {
        "id": "acc_123",
        "name": "Conta Corrente"
      },
      "created_at": "2026-01-01T10:00:00.000Z",
      "updated_at": "2026-01-20T09:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 25,
    "totalPages": 1
  }
}
```

---

## 📝 Modelo de Dados

### Transaction

```sql
-- Tabela principal de transações
CREATE TABLE transactions (
    id VARCHAR(255) PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    category_id VARCHAR(255) NULL,
    type ENUM('income', 'fixed_expense', 'variable_expense') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    due_date DATE NOT NULL,                 -- ⭐ Campo principal para calendário
    status ENUM('pending', 'executed', 'cancelled') DEFAULT 'pending',
    executed_date DATETIME NULL,            -- ⭐ Campo para calcular se está pago
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSON NULL,          -- Para transações recorrentes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Índices para performance do calendário
    INDEX idx_due_date (due_date),
    INDEX idx_account_due_date (account_id, due_date),
    INDEX idx_type_due_date (type, due_date),
    INDEX idx_status_due_date (status, due_date),
    INDEX idx_category_due_date (category_id, due_date),

    -- Chaves estrangeiras
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
```

### Categories

```sql
-- Tabela de categorias
CREATE TABLE categories (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('income', 'expense', 'both') DEFAULT 'both',
    color VARCHAR(7) NULL,                  -- Hex color para UI
    icon VARCHAR(50) NULL,                  -- Nome do ícone
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Accounts

```sql
-- Tabela de contas (já existente)
CREATE TABLE accounts (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('checking', 'savings', 'credit_card') NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 🔧 Regras de Negócio

### 1. Cálculo de Status

```pseudo
FUNCTION calculateStatus(transaction):
    IF transaction.status = 'executed' OR transaction.executed_date IS NOT NULL:
        RETURN 'paid'

    IF transaction.status = 'cancelled':
        RETURN 'pending'  // Ou poderia ser tratado diferente

    IF transaction.due_date < CURRENT_DATE():
        RETURN 'overdue'

    RETURN 'pending'
```

### 2. Filtros por Status

Quando o frontend enviar `statuses=pending,overdue`:

```sql
-- Backend deve aplicar lógica:
WHERE (
    (status = 'pending' AND due_date >= CURDATE())           -- pending
    OR
    (status IN ('pending') AND due_date < CURDATE())         -- overdue
)
```

### 3. Filtros por Período

```sql
-- Para consultas mensais (otimizada com índices)
WHERE due_date BETWEEN '2026-01-01' AND '2026-01-31'
```

### 4. Transações Recorrentes

Para futuras implementações de recorrência:

```json
// Campo recurrence_pattern
{
  "frequency": "monthly",          // monthly, weekly, yearly
  "interval": 1,                  // A cada X períodos
  "end_date": "2026-12-31",       // Data fim da recorrência
  "next_due_date": "2026-02-15"   // Próximo vencimento
}
```

---

## 🚀 Performance e Otimização

### 1. Índices de Banco

```sql
-- Índices essenciais para performance do calendário
CREATE INDEX idx_transactions_calendar_main ON transactions(due_date, account_id, type, status);
CREATE INDEX idx_transactions_calendar_category ON transactions(category_id, due_date);
CREATE INDEX idx_transactions_calendar_amount ON transactions(due_date, amount);
```

### 2. Cache Strategy

#### Nível de Aplicação
```typescript
// Implementar cache em memória para consultas frequentes
// Chave: `calendar:${accountId}:${year-month}:${filters_hash}`
// TTL: 5 minutos (same as frontend)

interface CacheKey {
  accountId: string
  yearMonth: string      // "2026-01"
  filtersHash: string    // MD5 dos filtros aplicados
}
```

#### Nível de Banco
```sql
-- Query cache para MySQL/MariaDB
SET GLOBAL query_cache_size = 268435456; -- 256MB
SET GLOBAL query_cache_type = ON;
```

### 3. Pagination

```typescript
// Para grandes volumes de transações
interface PaginationParams {
  page?: number = 1
  limit?: number = 100  // Max 500
}

// Response sempre incluir meta de paginação
interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}
```

---

## 📊 Casos de Uso Principais

### 1. Dashboard Widget - Próximos 7 dias

```http
GET /api/v1/transactions?startDate=2026-01-19&endDate=2026-01-26&limit=10
```

**Performance esperada**: < 50ms
**Cache**: 5 minutos
**Volume**: 5-15 transações

### 2. Calendário Mensal Completo

```http
GET /api/v1/transactions?startDate=2026-01-01&endDate=2026-01-31&limit=500
```

**Performance esperada**: < 100ms
**Cache**: 5 minutos
**Volume**: 50-200 transações

### 3. Calendário com Filtros

```http
GET /api/v1/transactions?startDate=2026-01-01&endDate=2026-01-31&types=income&statuses=pending&categories=cat1,cat2
```

**Performance esperada**: < 150ms
**Cache**: 3 minutos
**Volume**: 10-50 transações

### 4. Navegação Anual

```http
GET /api/v1/transactions?startDate=2026-01-01&endDate=2026-12-31&limit=1000
```

**Performance esperada**: < 300ms
**Cache**: 10 minutos
**Volume**: 200-1000 transações

---

## 🔒 Segurança e Autorização

### 1. Autenticação

```http
Authorization: Bearer <jwt_token>
```

### 2. Autorização por Conta

```typescript
// Middleware de autorização
function authorizeAccountAccess(userId: string, accountId: string): boolean {
  // Verificar se o usuário tem acesso à conta
  // Pode ser owner ou member com permissões
  return userHasAccessToAccount(userId, accountId)
}
```

### 3. Rate Limiting

```typescript
// Limites por endpoint
const rateLimits = {
  '/api/v1/transactions': {
    windowMs: 60 * 1000,    // 1 minuto
    maxRequests: 100        // 100 requests/min
  }
}
```

### 4. Validação de Entrada

```typescript
// Validação de query parameters
interface TransactionQueryValidator {
  startDate: Date         // Máximo 1 ano no passado
  endDate: Date           // Máximo 1 ano no futuro
  types?: string[]        // Enum válido
  statuses?: string[]     // Enum válido
  categories?: string[]   // UUIDs válidos
  accountId?: string      // UUID válido e autorizado
  limit?: number          // 1-500
  page?: number           // 1-1000
}
```

---

## 📈 Métricas e Monitoramento

### 1. Performance Metrics

```typescript
// Métricas a coletar
interface CalendarMetrics {
  query_duration_ms: number
  cache_hit_rate: number
  records_returned: number
  filters_applied: string[]
  date_range_days: number
}
```

### 2. Business Metrics

```typescript
// Analytics do calendário
interface CalendarAnalytics {
  most_used_filters: string[]
  avg_transactions_per_month: number
  peak_usage_hours: number[]
  common_date_ranges: string[]
}
```

---

## 🧪 Casos de Teste

### 1. Testes de Unidade

```typescript
describe('CalendarService', () => {
  describe('getTransactionsByPeriod', () => {
    it('deve retornar transações no período especificado', async () => {
      const result = await calendarService.getTransactionsByPeriod({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        accountId: 'acc_123'
      })

      expect(result.transactions).toHaveLength(25)
      expect(result.transactions[0].due_date).toBe('2026-01-15')
    })

    it('deve aplicar filtros de status corretamente', async () => {
      const result = await calendarService.getTransactionsByPeriod({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        statuses: ['overdue']
      })

      result.transactions.forEach(txn => {
        expect(new Date(txn.due_date)).toBeLessThan(new Date())
        expect(txn.status).toBe('pending')
      })
    })
  })
})
```

### 2. Testes de Integração

```typescript
describe('Calendar API Integration', () => {
  it('deve retornar dados formatados corretamente', async () => {
    const response = await request(app)
      .get('/api/v1/transactions')
      .query({
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      })
      .expect(200)

    expect(response.body).toHaveProperty('transactions')
    expect(response.body).toHaveProperty('pagination')
    expect(response.body.transactions[0]).toMatchObject({
      id: expect.any(String),
      due_date: expect.any(String),
      amount: expect.any(Number),
      category: expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String)
      })
    })
  })
})
```

### 3. Testes de Performance

```typescript
describe('Calendar Performance', () => {
  it('deve responder em menos de 100ms para consulta mensal', async () => {
    const start = Date.now()

    await request(app)
      .get('/api/v1/transactions')
      .query({
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      })

    const duration = Date.now() - start
    expect(duration).toBeLessThan(100)
  })
})
```

---

## 📦 Checklist de Implementação

### Fase 1: API Básica ⏳
- [ ] Criar modelo `Transaction` no banco
- [ ] Implementar endpoint `GET /api/v1/transactions`
- [ ] Adicionar filtros básicos (período, tipo, status)
- [ ] Implementar paginação
- [ ] Adicionar índices de performance

### Fase 2: Filtros Avançados ⏳
- [ ] Filtros por categoria
- [ ] Filtros por conta específica
- [ ] Combinação múltipla de filtros
- [ ] Validação de parâmetros
- [ ] Tratamento de edge cases

### Fase 3: Performance ⏳
- [ ] Implementar cache em memória
- [ ] Otimizar queries com EXPLAIN
- [ ] Adicionar rate limiting
- [ ] Implementar compressão de response
- [ ] Configurar query cache

### Fase 4: Segurança ⏳
- [ ] Middleware de autenticação
- [ ] Autorização por conta
- [ ] Validação rigorosa de entrada
- [ ] Sanitização de queries
- [ ] Logs de auditoria

### Fase 5: Monitoramento ⏳
- [ ] Métricas de performance
- [ ] Logs estruturados
- [ ] Health checks
- [ ] Analytics de uso
- [ ] Alertas de performance

### Fase 6: Testes ⏳
- [ ] Testes de unidade (>90% cobertura)
- [ ] Testes de integração
- [ ] Testes de performance
- [ ] Testes de carga
- [ ] Documentação da API

---

## 📊 Critérios de Aceitação

### Performance
- [ ] **Response time** < 100ms para consultas mensais
- [ ] **Response time** < 50ms para widget (7 dias)
- [ ] **Cache hit rate** > 80% para consultas repetidas
- [ ] **Suporte** a 100 requests/min por usuário

### Funcionalidade
- [ ] **Filtros** funcionando conforme especificação
- [ ] **Paginação** eficiente para grandes volumes
- [ ] **Status calculation** preciso (pending/paid/overdue)
- [ ] **Date range** até 1 ano sem degradação

### Qualidade
- [ ] **Test coverage** > 90%
- [ ] **Error handling** robusto
- [ ] **Input validation** completa
- [ ] **Documentation** atualizada (OpenAPI)

---

## 🔗 Dependências Externas

### Banco de Dados
- **MySQL/MariaDB** 8.0+ (índices otimizados)
- **Redis** (cache opcional mas recomendado)

### Infraestrutura
- **Load Balancer** (para múltiplas instâncias)
- **Monitoring** (New Relic, DataDog, ou similar)
- **CDN** (para cache de responses estáticas)

---

## 📞 Considerações Futuras

### Funcionalidades Avançadas (v2.0)
1. **Transações Recorrentes** - Geração automática de vencimentos
2. **Notificações** - Alertas de vencimento via email/push
3. **Webhooks** - Integração com sistemas externos
4. **Bulk Operations** - Operações em lote via API
5. **GraphQL** - API alternativa para queries complexas

### Otimizações (v2.0)
1. **Read Replicas** - Separar leitura/escrita
2. **Partitioning** - Particionar por data/conta
3. **Materialized Views** - Views pré-calculadas
4. **Event Sourcing** - Para auditoria completa

---

**Documento criado em**: Janeiro 2026
**Próxima revisão**: Implementação completa
**Versão**: 1.0
**Responsável**: Equipe BFIN Backend

---

## 🎯 Resumo Executivo

Esta especificação define **exatamente** o que o backend precisa implementar para suportar o calendário já funcional no frontend. A prioridade é implementar a **Fase 1** rapidamente para que o calendário seja funcional em produção.

**Entrega crítica**: Endpoint `GET /api/v1/transactions` com filtros por período e tipos básicos.

**Timeline sugerida**: 2-3 sprints para implementação completa das fases 1-3.