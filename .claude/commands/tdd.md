---
description: Guia o fluxo TDD (Red → Green → Refactor) com Clean Architecture, SOLID e Design Patterns para implementar uma funcionalidade com base nos cenários de aceitação do spec
argument-hint: "<user-story-id> ou descrição da funcionalidade"
---

# TDD + Clean Architecture: Desenvolvimento Orientado a Testes

Você vai implementar a funcionalidade `$ARGUMENTS` usando TDD estrito, respeitando Clean Architecture, princípios SOLID e Design Patterns quando necessário.

**Regra de ouro**: nunca escreva código de produção antes de ter um teste falhando.

---

## Princípios Inegociáveis

### TDD
- **Red primeiro**: todo código de produção nasce de um teste falhando
- **Green mínimo**: escreva apenas o suficiente para o teste passar, sem antecipar requisitos
- **Refactor com testes verdes**: só refatore quando todos os testes estiverem passando
- **Um ciclo por vez**: não avance para o próximo cenário antes de completar o ciclo atual

### Clean Architecture (Camadas do Projeto)

```
┌─────────────────────────────────────────┐
│  Presentation (routes/ + controllers/)  │  ← HTTP, req/res, status codes
├─────────────────────────────────────────┤
│  Application (services/)               │  ← Use cases, orquestração, regras de negócio
├─────────────────────────────────────────┤
│  Domain (types/ + utils/)              │  ← Entidades, cálculos, regras puras
├─────────────────────────────────────────┤
│  Infrastructure (lib/ + validators/)   │  ← Prisma, Redis, Zod schemas, externos
└─────────────────────────────────────────┘
```

**Regra de dependência**: camadas externas dependem das internas — nunca o contrário.
- `services/` podem usar `types/` e `lib/`, mas `types/` não deve importar de `services/`
- Controllers não contêm lógica de negócio — apenas delegam ao serviço
- Validação de entrada (Zod) fica em `validators/`, nunca no serviço ou controller

### SOLID
- **S** — Single Responsibility: cada classe/função tem uma única razão para mudar
- **O** — Open/Closed: use herança/composição para estender, não modifique código existente
- **L** — Liskov Substitution: subtipos de `AppError` são substituíveis onde `AppError` é esperado
- **I** — Interface Segregation: `PrismaLikeClient` aceita tanto `PrismaClient` quanto `TransactionClient` — não force dependências desnecessárias
- **D** — Dependency Inversion: injete dependências via parâmetro (ex: `client?: PrismaLikeClient`) em vez de instanciar dentro do método

---

## Fase 0: Leitura e Alinhamento

**Objetivo**: entender o que precisa ser testado e projetar a arquitetura antes de escrever qualquer linha

**Ações**:
1. Crie uma lista de tarefas com todas as fases
2. Localize o spec em `/specs/<feature>/spec.md` e leia os **Acceptance Scenarios**
3. Leia `tasks.md` (dependências) e `data-model.md` (modelo de dados)
4. Explore código existente similar:
   - Qual serviço tem padrão parecido? (ex: `AccountService`, `LoanSimulationService`)
   - Como erros são lançados? (`ValidationError`, `NotFoundError` de `errorHandler.ts`)
   - Existe lógica reutilizável em `utils/`?
5. **Projete a arquitetura da funcionalidade** antes de escrever testes:
   - Quais métodos novos o Service precisará?
   - O Controller precisa de novo método ou estende um existente?
   - Há lógica que pertence a `utils/` (cálculos puros, sem I/O)?
   - Algum Design Pattern se aplica? (ver seção abaixo)
6. Apresente ao usuário:
   - Arquitetura planejada (camadas afetadas, responsabilidades)
   - Quais cenários serão cobertos e quantos ciclos Red→Green
   - Quais Design Patterns serão usados e por quê
7. **Aguarde confirmação antes de prosseguir**

---

## Fase 1: RED — Escreva o Teste Falhando

**Objetivo**: ter um teste que falha pela razão certa (ausência de implementação, não erro de sintaxe)

### 1a. Testes de Integração (obrigatório para rotas HTTP)

Crie ou estenda `tests/integration/<feature>.<action>.test.ts`:

```typescript
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import app from '../../src/server';

describe('MÉTODO /api/v1/<recurso>/<ação>', () => {
  const createdUserIds: string[] = [];
  const createdAccountIds: string[] = [];
  let token = '';
  let userId = '';

  beforeEach(async () => {
    // Email único por teste garante isolamento
    const email = `<feature>-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, password_hash: 'test-hash', full_name: 'Tester' },
    });
    userId = user.id;
    createdUserIds.push(user.id);
    // Criar conta e demais dados de suporte...
    token = jwt.sign({ userId: user.id, email }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Limpar em ordem inversa de FK constraints
    if (createdUserIds.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { user_id: { in: createdUserIds } } });
      // ... demais entidades dependentes
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it('cenário feliz — deve [resultado esperado]', async () => {
    // Given: dados criados no beforeEach
    // When
    const response = await request(app)
      .post('/api/v1/...')
      .set('Authorization', `Bearer ${token}`)
      .send({ ... });
    // Then
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ... });
  });

  // Um it() por cenário de aceitação do spec
  // Cobrir: 401 (sem auth), 404 (não encontrado), 400 (validação de negócio)
  // Verificar efeitos colaterais: status no banco, audit events, saldos
});
```

### 1b. Testes Unitários (obrigatório para lógica de serviço complexa)

Crie ou estenda `tests/unit/<feature>.service.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';

vi.mock('../../src/lib/prisma', () => ({
  default: {
    <entidade>: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

describe('FeatureService.<método>', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deve lançar ValidationError quando [condição inválida]', async () => {
    // Arrange
    vi.mocked(prisma.<entidade>.findFirst).mockResolvedValue(null);
    // Act + Assert
    await expect(service.método('user-id', 'sim-id'))
      .rejects.toThrow(ValidationError);
  });
});
```

**Regras para testes unitários**:
- Testar comportamento (o que faz), não implementação (como faz)
- Cobrir: validações de negócio, cálculos, transformações, casos de erro
- `vi.mock` para Prisma e serviços externos; injetar dependências via parâmetro quando possível

### 1c. Confirme o RED

```bash
npm test -- tests/integration/<feature>.test.ts
```

**Esperado**: falha com "rota não encontrada" ou "método não existe". Se falhar por erro de TypeScript ou sintaxe, corrija o teste — **o teste deve falhar pela razão certa**.

---

## Fase 2: GREEN — Implementação Mínima com Arquitetura Correta

**Objetivo**: fazer o teste passar respeitando as camadas e responsabilidades

**Ordem obrigatória** (nunca pule camadas):

```
Domain/Utils → Service → Controller → Route → Schemas
```

### Passo 1 — Domain/Utils (se há lógica pura)

Se a funcionalidade envolve cálculos ou transformações sem I/O (ex: cálculo de juros, validação de regra financeira), extraia para `src/utils/<feature>Calculator.ts` ou método estático:

```typescript
// src/utils/loanValidations.ts — lógica pura, sem Prisma, sem Express
export function exceedsReserveLimit(total: number, reserve: number, limitPercent: number): boolean {
  return total > reserve * (limitPercent / 100);
}
```

Benefício: testável isoladamente sem mocks, reutilizável entre serviços.

### Passo 2 — Service (`src/services/<Feature>Service.ts`)

Responsabilidade: **orquestrar use cases**. Nunca lide com `req`/`res` aqui.

```typescript
export class FeatureService {
  // DIP: aceitar client externo para suporte a transações (padrão do projeto)
  async executeAction(userId: string, input: ActionInput, client?: PrismaLikeClient): Promise<Result> {
    const db = client ?? prisma;

    // 1. Buscar e validar recurso (NotFoundError se não existe/não pertence ao usuário)
    const resource = await db.entity.findFirst({ where: { id: input.id, user_id: userId } });
    if (!resource) throw new NotFoundError('Recurso não encontrado');

    // 2. Validar regras de negócio (ValidationError para estado inválido)
    if (resource.status !== 'VALID_STATE') {
      throw new ValidationError('Mensagem descritiva do erro de negócio');
    }

    // 3. Executar operação atômica (sempre em transaction para operações financeiras)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.entity.update({ where: { id: resource.id }, data: { ... } });
      // Audit event dentro da mesma transaction
      await auditEventService.writeEvent({ ... }, tx);
      return updated;
    });
  }
}
```

**SOLID no Service**:
- **SRP**: um método por use case (não misture "aprovar" com "retirar" no mesmo método)
- **DIP**: receba dependências como parâmetro (`client?: PrismaLikeClient`) — não instancie dentro
- **OCP**: para adicionar nova validação, adicione método privado — não modifique o fluxo principal

### Passo 3 — Controller (`src/controllers/<feature>.controller.ts`)

Responsabilidade: **adaptar HTTP para use cases**. Sem lógica de negócio.

```typescript
export class FeatureController {
  async action(req: Request, res: Response): Promise<void> {
    // 1. Verificar autenticação (responsabilidade do controller, não do serviço)
    if (!req.user) {
      res.status(401).json({ error: 'UnauthorizedError', message: 'Not authenticated' });
      return;
    }

    // 2. Extrair e validar entrada HTTP
    const { id } = req.params;
    const body = ActionSchema.parse(req.body); // Zod valida — lança ZodError se inválido

    // 3. Delegar ao serviço (deixar errorHandler capturar erros)
    const result = await featureService.executeAction(req.user.userId, { id, ...body });

    // 4. Serializar resposta
    res.status(200).json({ data: result, message: 'Operação realizada com sucesso' });
  }
}
```

**O que NÃO fazer no Controller**:
- Lógica de negócio (validação de regras, cálculos)
- Acesso direto ao Prisma
- try/catch para regras de negócio (o `errorHandler` middleware já trata `AppError` e `ZodError`)

### Passo 4 — Route (`src/routes/<feature>.routes.ts`)

```typescript
router.post('/:id/action', authenticate, controller.action.bind(controller));
```

### Passo 5 — Schemas (`src/validators/<feature>Schemas.ts`)

```typescript
export const ActionSchema = z.object({
  field: z.string().uuid(),
});
export type ActionInput = z.infer<typeof ActionSchema>;
```

### Valide o GREEN

```bash
npm test -- tests/integration/<feature>.test.ts
```

**Esperado**: todos os testes do arquivo passam. Se algum falha, continue aqui — não avance para Refactor.

---

## Fase 3: REFACTOR — Qualidade sem Quebrar

**Objetivo**: melhorar design e legibilidade mantendo todos os testes verdes

### Checklist SOLID

- [ ] **SRP**: cada classe/função tem uma única razão para mudar?
  - Se um Service tem >3 responsabilidades, extraia para serviços auxiliares
  - Funções de validação complexa → métodos privados ou `utils/`
- [ ] **OCP**: para adicionar comportamento, foi necessário modificar código existente?
  - Se sim, considere Strategy Pattern para variar comportamento
- [ ] **DIP**: dependências são injetadas ou instanciadas dentro dos métodos?
  - Prefira receber `PrismaLikeClient` por parâmetro (padrão já estabelecido no projeto)

### Checklist Clean Architecture

- [ ] Controller não faz queries no banco? (todo acesso ao Prisma via Service)
- [ ] Service não manipula `req`/`res`? (zero importações de `express` no service)
- [ ] Lógica de cálculo pura está em `utils/` (testável sem mocks)?
- [ ] Tipos novos estão exportados em `src/types/`?
- [ ] Constantes nomeadas para magic numbers?

### Aplicar Design Patterns quando necessário

Avalie se algum padrão melhora o design — use apenas quando há ganho real:

**Strategy** — quando o mesmo use case tem múltiplas implementações intercambiáveis:
```typescript
// Exemplo: múltiplas estratégias de validação de limite
interface LimitValidationStrategy {
  validate(amount: number, reserve: number): void;
}
class ReserveLimitStrategy implements LimitValidationStrategy { ... }
class FixedLimitStrategy implements LimitValidationStrategy { ... }
```

**Factory Method** — quando a criação de um objeto é complexa ou varia por contexto:
```typescript
// Exemplo: criar diferentes tipos de audit event
class AuditEventFactory {
  static createApproval(userId: string, simulationId: string): AuditEventInput { ... }
  static createWithdrawal(userId: string, simulationId: string, balances: Balances): AuditEventInput { ... }
}
```

**Template Method** — quando múltiplos use cases compartilham o mesmo esqueleto de passos:
```typescript
abstract class FinancialOperationService {
  async execute(userId: string, input: unknown) {
    const resource = await this.findAndValidate(userId, input);  // passo fixo
    await this.checkBusinessRules(resource);                      // passo fixo
    return this.performOperation(resource);                       // passo variável (abstract)
  }
  protected abstract performOperation(resource: unknown): Promise<unknown>;
}
```

**Observer (via AuditEventService)** — já implementado no projeto para efeitos colaterais de auditoria. Prefira sempre injetar o `AuditEventService` na transaction em vez de disparar eventos soltos.

**Quando NÃO usar padrões**:
- Não abstraia o que ainda tem um único uso — YAGNI (You Aren't Gonna Need It)
- Não crie interfaces para classes que têm apenas uma implementação concreta
- Não use Factory se `new MinhaClasse()` resolve com clareza

### Valide o REFACTOR

```bash
npm test && npm run lint
```

**Ambos devem passar.** Se lint falhar, corrija antes de prosseguir.

---

## Fase 4: Próximo Ciclo

Para cada User Story restante, repita:
1. **Fase 1** → escreva os testes falhando
2. **Fase 2** → implemente com arquitetura correta
3. **Fase 3** → refatore verificando SOLID, Clean Architecture e Design Patterns

---

## Fase 5: Validação Final

**Objetivo**: garantir que o código está pronto, sem regressões e com arquitetura saudável

**Ações**:
1. Suite completa:
   ```bash
   npm test && npm run lint
   ```
2. Verifique regressões — nenhum teste existente pode quebrar
3. Revise cobertura do spec — todo Acceptance Scenario tem `it()` correspondente
4. **Revisão de arquitetura final**:
   - As camadas estão corretas? (dependencies point inward)
   - Algum Service cresceu demais e virou God Class? (SRP violado)
   - Há código duplicado que poderia ser extraído para `utils/`?
5. Apresente ao usuário:
   - Testes criados/estendidos (com contagem por tipo: integration/unit)
   - Arquivos modificados por camada (routes, controllers, services, utils, types)
   - Cenários de aceitação cobertos vs total do spec
   - Design Patterns aplicados e justificativa
   - Qualquer débito técnico identificado e recomendação

---

## Referência Rápida: Padrões do Projeto

### Hierarquia de Erros (AppError → subclasses)

| Erro | Status | Quando usar |
|------|--------|-------------|
| `ValidationError` | 400 | Estado inválido, regra de negócio violada, parâmetro fora do range |
| `UnauthorizedError` | 401 | Sem autenticação ou token inválido |
| `ForbiddenError` | 403 | Autenticado mas sem permissão |
| `NotFoundError` | 404 | Recurso não existe ou não pertence ao usuário |
| `InsufficientBalanceError` | 400 | Saldo insuficiente (subclasse de ValidationError semântica) |

### Transações Financeiras (obrigatório)

```typescript
// Todo código que modifica saldos DEVE ser atômico
return prisma.$transaction(async (tx) => {
  await tx.account.update({ where: { id }, data: { balance: { decrement: amount } } });
  await tx.account.update({ where: { id }, data: { reserve: { increment: amount } } });
  await auditEventService.writeEvent({ ... }, tx); // audit dentro da mesma tx
});
```

### Injeção de Client (DIP — padrão do projeto)

```typescript
type PrismaLikeClient = PrismaClient | Prisma.TransactionClient;

async myMethod(input: Input, client?: PrismaLikeClient): Promise<Output> {
  const db = client ?? prisma; // usa client externo se injetado (suporte a nested transactions)
}
```

### Estrutura de Testes

| Tipo | Localização | Quando criar |
|------|-------------|--------------|
| Integration | `tests/integration/<feature>.<action>.test.ts` | Toda rota HTTP nova |
| Unit | `tests/unit/<feature>.service.test.ts` | Lógica de negócio complexa no serviço |
| Unit | `tests/unit/<feature>.controller.test.ts` | Controller com lógica de decisão |
