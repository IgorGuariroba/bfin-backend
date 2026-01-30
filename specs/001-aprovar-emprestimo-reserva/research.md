# Research: Aprovar Simulação de Empréstimo e Retirar da Reserva

**Date**: 2026-01-28
**Feature**: 001-aprovar-emprestimo-reserva
**Purpose**: Document all technical decisions and research findings for implementation

---

## 1. State Management Strategy

### Decision: Enum-based Status Field in Database

**Rationale**:
- Simple state machine with 3 states: `PENDING`, `APPROVED`, `COMPLETED`
- PostgreSQL native enum support via Prisma
- Type-safe queries and validation
- Clear audit trail with state transitions

**Implementation**:
```prisma
enum LoanSimulationStatus {
  PENDING    // Initial state after creation
  APPROVED   // After user approves (ready for withdrawal)
  COMPLETED  // After successful withdrawal
}

model LoanSimulation {
  // ... existing fields ...
  status          LoanSimulationStatus @default(PENDING)
  approved_at     DateTime?
  withdrawn_at    DateTime?
}
```

**Alternatives Considered**:
- ❌ **Separate LoanApproval table**: Adds unnecessary complexity, harder to query current state
- ❌ **Boolean flags (is_approved, is_withdrawn)**: Error-prone, allows invalid states (both true/false)
- ❌ **String status without enum**: No type safety, prone to typos

**References**:
- Existing pattern: Account model uses enum for `type` field
- Prisma docs: https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#defining-enums

---

## 2. Balance Transfer Mechanism

### Decision: Atomic Transaction with Increment/Decrement Operations

**Rationale**:
- Follows existing TransactionService pattern for balance updates
- Prisma transaction ensures atomicity (all-or-nothing)
- Increment/decrement prevents race conditions vs read-modify-write
- Audit event included within same transaction

**Implementation Pattern** (from existing code):
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Validate reserve limit (70%)
  const account = await tx.account.findUnique({ where: { id: accountId } });
  const maxAllowed = account.emergency_reserve * 0.70;
  if (amount > maxAllowed) throw new ValidationError(...);

  // 2. Update balances atomically
  await tx.account.update({
    where: { id: accountId },
    data: {
      emergency_reserve: { decrement: amount },
      available_balance: { increment: amount },
    }
  });

  // 3. Update simulation status
  await tx.loanSimulation.update({
    where: { id: simulationId },
    data: {
      status: 'COMPLETED',
      withdrawn_at: new Date()
    }
  });

  // 4. Create audit event
  await auditEventService.writeEvent({ ... }, tx);
});
```

**Alternatives Considered**:
- ❌ **Separate transactions**: Risk of partial failure (balance updated but status not)
- ❌ **Two-phase commit**: Unnecessary complexity for single-database operation
- ❌ **Optimistic locking**: Prisma transactions already handle this

**References**:
- Existing implementation: `/src/services/TransactionService.ts` lines 99-150
- Prisma transactions: https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide

---

## 3. 70% Reserve Limit Validation

### Decision: Dual Validation (Approval + Withdrawal) with Active Loan Calculation

**Rationale**:
- Protects against reserve changes between approval and withdrawal
- Prevents over-commitment if multiple simulations approved concurrently
- Aligns with FR-014 and FR-019 requirements

**Calculation Logic**:
```typescript
// Active loans = sum of all APPROVED or COMPLETED simulations
const activeLoanTotal = await tx.loanSimulation.aggregate({
  where: {
    user_id: userId,
    status: { in: ['APPROVED', 'COMPLETED'] }
  },
  _sum: { principal_amount: true }
});

const currentReserve = account.emergency_reserve;
const maxAllowed = currentReserve * 0.70;
const newTotal = (activeLoanTotal._sum.principal_amount || 0) + newAmount;

if (newTotal > maxAllowed) {
  throw new ValidationError('Total active loans would exceed 70% reserve limit');
}
```

**Edge Case Handling**:
- **Concurrent approvals**: Transaction isolation prevents race conditions
- **Reserve reduction after approval**: Withdrawal validation catches this
- **Already withdrawn**: Status check prevents duplicate withdrawal

**Alternatives Considered**:
- ❌ **Validation only at approval**: Unsafe if reserve changes before withdrawal
- ❌ **Validation only at withdrawal**: Allows users to approve more than they can withdraw
- ❌ **Lock reserve at approval**: Complicates balance management, blocks other operations

**References**:
- Existing constant: `LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT = 70` in `/src/types/loanSimulation.ts`
- Existing validation: `/src/services/loanSimulationService.ts` lines 71-77

---

## 4. 30-Day Expiration Validation

### Decision: Date Comparison at Approval Time with Millisecond Precision

**Rationale**:
- Simple date arithmetic using JavaScript Date API
- No background jobs or scheduled cleanup needed
- Clear error message guides user to create new simulation

**Implementation**:
```typescript
const EXPIRATION_DAYS = 30;
const now = new Date();
const createdAt = simulation.created_at;
const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

if (daysSinceCreation > EXPIRATION_DAYS) {
  throw new ValidationError(
    `Simulation expired. Created ${Math.floor(daysSinceCreation)} days ago. ` +
    `Maximum age is ${EXPIRATION_DAYS} days. Please create a new simulation.`
  );
}
```

**Alternatives Considered**:
- ❌ **Cron job to mark expired**: Adds complexity, doesn't prevent approval attempts
- ❌ **Database constraint**: PostgreSQL has no native "age-based" constraint
- ❌ **Soft delete expired**: Clutters database, users can still see but not use

**References**:
- Clarification: spec.md lines 76, 88, A-001
- Requirement: FR-016

---

## 5. Authorization Pattern

### Decision: JWT User-Scoped with Owner Verification

**Rationale**:
- Extends existing authentication middleware pattern
- User can only approve/withdraw their own simulations
- No additional ACL complexity needed

**Implementation**:
```typescript
// Middleware: authenticate() adds req.user
router.post('/:id/approve', authenticate, controller.approve);

// Controller
async approve(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const simulation = await loanSimulationService.approveSimulation(
    req.user.userId,
    req.params.id
  );

  res.status(200).json(simulation);
}

// Service
async approveSimulation(userId: string, simulationId: string) {
  const simulation = await prisma.loanSimulation.findFirst({
    where: { id: simulationId, user_id: userId }  // User-scoped
  });

  if (!simulation) {
    throw new NotFoundError('Simulation not found');
  }

  // ... approval logic
}
```

**Alternatives Considered**:
- ❌ **Account-level permissions**: Simulations are user-scoped, not account-scoped
- ❌ **Role-based access**: Current spec only supports self-approval (C-002)
- ❌ **Admin override**: Explicitly out of scope (OS-006)

**References**:
- Existing pattern: All LoanSimulation queries use `WHERE user_id = userId`
- Middleware: `/src/middlewares/auth.ts`
- Constraint: spec.md C-002

---

## 6. Audit Trail Strategy

### Decision: Extend Existing AuditEvent Pattern with Structured Payloads

**Rationale**:
- Reuses existing `AuditEventService.writeEvent()` infrastructure
- JSON payload allows flexible event-specific data
- Supports compliance requirements (FR-010, FR-011, SC-005)

**Event Types**:
```typescript
// Approval event
{
  eventType: 'loan_simulation_approved',
  userId: string,
  accountId: string,
  simulationId: string,
  payload: {
    principal_amount: number,
    term_months: number,
    reserve_usage_percent: number,
    approved_at: string (ISO 8601),
    days_since_creation: number
  }
}

// Withdrawal event
{
  eventType: 'loan_simulation_withdrawn',
  userId: string,
  accountId: string,
  simulationId: string,
  payload: {
    amount: number,
    reserve_balance_before: number,
    reserve_balance_after: number,
    available_balance_before: number,
    available_balance_after: number,
    withdrawn_at: string (ISO 8601)
  }
}
```

**Alternatives Considered**:
- ❌ **Separate audit tables**: More schema complexity, harder to query unified audit log
- ❌ **Only log errors**: Doesn't meet compliance requirement for 100% audit
- ❌ **External audit service**: Adds network dependency, complicates transactions

**References**:
- Existing service: `/src/services/AuditEventService.ts`
- Existing usage: `/src/services/loanSimulationService.ts` lines 124-139
- Requirements: FR-010, FR-011, SC-005

---

## 7. Error Handling & Messages

### Decision: Domain-Specific Error Classes with Descriptive Messages

**Rationale**:
- Follows existing error handler pattern
- Provides actionable error messages for API consumers
- Maps to appropriate HTTP status codes

**Error Scenarios**:

| Scenario | Error Class | Status | Message |
|----------|-------------|--------|---------|
| Simulation not found | NotFoundError | 404 | "Loan simulation not found" |
| Already approved | ValidationError | 400 | "Simulation is already approved" |
| Already completed | ValidationError | 400 | "Simulation already completed - funds have been withdrawn" |
| Expired (>30 days) | ValidationError | 400 | "Simulation expired. Created {X} days ago. Maximum age is 30 days. Please create a new simulation." |
| 70% limit exceeded | ValidationError | 400 | "Total active loans would exceed 70% reserve limit. Current reserve: {X}, maximum allowed: {Y}, requested: {Z}" |
| Insufficient reserve | ValidationError | 400 | "Insufficient emergency reserve balance. Required: {X}, available: {Y}" |
| Not approved yet | ValidationError | 400 | "Cannot withdraw - simulation must be approved first" |
| Unauthorized | UnauthorizedError | 401 | "Unauthorized" |

**Alternatives Considered**:
- ❌ **Generic error codes**: Less developer-friendly, requires documentation lookup
- ❌ **i18n error messages**: Out of scope (OS-005 - no notifications)
- ❌ **Stack traces in production**: Security risk, existing error handler already filters

**References**:
- Error classes: `/src/middlewares/errorHandler.ts`
- Requirement: FR-013

---

## 8. API Endpoint Design

### Decision: RESTful Sub-Resource Actions

**Rationale**:
- Follows REST conventions for resource actions
- Consistent with existing API patterns
- Clear intent from URL structure

**Endpoints**:
```
POST   /api/v1/loan-simulations/:id/approve
POST   /api/v1/loan-simulations/:id/withdraw
GET    /api/v1/loan-simulations/:id          (extend with status field)
GET    /api/v1/loan-simulations               (extend with status filtering)
```

**Request/Response Examples**:

```typescript
// POST /api/v1/loan-simulations/:id/approve
Request: {} (no body needed)
Response: {
  id: "uuid",
  status: "APPROVED",
  approved_at: "2026-01-28T10:30:00Z",
  principal_amount: 500.00,
  // ... other simulation fields
}

// POST /api/v1/loan-simulations/:id/withdraw
Request: {} (no body needed)
Response: {
  id: "uuid",
  status: "COMPLETED",
  withdrawn_at: "2026-01-28T10:35:00Z",
  balances: {
    emergency_reserve_before: 1000.00,
    emergency_reserve_after: 500.00,
    available_balance_before: 200.00,
    available_balance_after: 700.00
  },
  // ... other simulation fields
}

// GET /api/v1/loan-simulations?status=APPROVED
Response: {
  simulations: [
    { id: "uuid", status: "APPROVED", approved_at: "...", ... },
    // ... more simulations
  ],
  pagination: { total: 10, offset: 0, limit: 50 }
}
```

**Alternatives Considered**:
- ❌ **PATCH with status field**: Allows arbitrary status changes, violates state machine
- ❌ **RPC-style `/approve-simulation`**: Not RESTful, inconsistent with existing API
- ❌ **Combined `/approve-and-withdraw`**: Violates FR-018 (separate operations)

**References**:
- Existing routes: `/src/routes/loanSimulations.routes.ts`
- REST best practices: https://restfulapi.net/resource-naming/

---

## 9. Validation Schema Strategy

### Decision: Zod Schemas for Type-Safe Validation

**Rationale**:
- Extends existing Zod validation pattern
- Type-safe with TypeScript inference
- Reusable across API and business logic layers

**Schemas**:
```typescript
// No request body validation needed (only :id param)
// Status transitions validated in service layer

// Response schemas (for SDK generation)
export const LoanSimulationStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'COMPLETED'
]);

export const ApprovalResponseSchema = z.object({
  id: z.string().uuid(),
  status: LoanSimulationStatusSchema,
  approved_at: z.string().datetime().nullable(),
  withdrawn_at: z.string().datetime().nullable(),
  principal_amount: z.number(),
  term_months: z.number(),
  // ... existing fields
});

export type ApprovalResponse = z.infer<typeof ApprovalResponseSchema>;
```

**Alternatives Considered**:
- ❌ **No validation**: Unsafe, allows invalid data
- ❌ **Manual validation**: Error-prone, not type-safe
- ❌ **Class-validator**: Different from existing patterns

**References**:
- Existing schemas: `/src/validators/loanSimulationSchemas.ts`
- Zod docs: https://zod.dev/

---

## 10. Testing Strategy

### Decision: Comprehensive Integration + Unit Test Coverage

**Rationale**:
- Follows existing test patterns
- Integration tests verify end-to-end flow including DB
- Unit tests verify business logic in isolation
- Critical for financial operations (SC-002, SC-003)

**Test Structure**:

**Integration Tests** (`tests/integration/loanSimulations.approve.test.ts`):
```typescript
describe('POST /api/v1/loan-simulations/:id/approve', () => {
  // Setup: Create user, account with reserve, JWT token
  // Test: Happy path - successful approval
  // Test: 401 - no authentication
  // Test: 404 - simulation not found
  // Test: 400 - already approved
  // Test: 400 - expired (>30 days)
  // Test: 400 - would exceed 70% limit
  // Cleanup: Delete in reverse FK order
});
```

**Integration Tests** (`tests/integration/loanSimulations.withdraw.test.ts`):
```typescript
describe('POST /api/v1/loan-simulations/:id/withdraw', () => {
  // Setup: Create simulation and approve it
  // Test: Happy path - successful withdrawal with balance verification
  // Test: 400 - not approved yet
  // Test: 400 - already completed
  // Test: 400 - insufficient reserve (changed after approval)
  // Test: 400 - would exceed 70% limit (reserve reduced)
  // Test: Transaction rollback on failure
  // Cleanup: Delete all created records
});
```

**Unit Tests** (`tests/unit/loanSimulations.controller.test.ts`):
```typescript
describe('LoanSimulationsController.approve', () => {
  // Mock: loanSimulationService.approveSimulation
  // Test: Calls service with correct userId and simulationId
  // Test: Returns 200 with simulation data
  // Test: Returns 401 if no user
  // Test: Passes errors from service to error handler
});
```

**Alternatives Considered**:
- ❌ **Only integration tests**: Slow, hard to test edge cases
- ❌ **Only unit tests**: Doesn't verify DB operations
- ❌ **Manual testing**: Not repeatable, no regression protection

**References**:
- Existing patterns: `/tests/integration/loanSimulations.create.test.ts`
- Vitest docs: https://vitest.dev/guide/

---

## 11. Migration Strategy

### Decision: Prisma Schema Migration with Default Values

**Rationale**:
- Prisma handles schema changes automatically
- Default value ensures existing simulations work
- No data migration script needed

**Migration Plan**:
```prisma
// Step 1: Add enum
enum LoanSimulationStatus {
  PENDING
  APPROVED
  COMPLETED
}

// Step 2: Add fields to LoanSimulation
model LoanSimulation {
  // ... existing fields ...
  status       LoanSimulationStatus @default(PENDING)
  approved_at  DateTime?
  withdrawn_at DateTime?
}
```

**Execution**:
```bash
npx prisma migrate dev --name add-loan-simulation-status
```

**Backwards Compatibility**:
- Existing simulations get `PENDING` status automatically
- Existing GET endpoints return new fields (nullable timestamps)
- SDK regeneration with Orval captures new fields

**Alternatives Considered**:
- ❌ **Separate migration script**: Unnecessary, default value handles it
- ❌ **Manual ALTER TABLE**: Prisma migrations are safer and tracked in version control
- ❌ **New table for status**: Adds joins, complicates queries

**References**:
- Prisma migrations: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Existing schema: `/prisma/schema.prisma`

---

## Summary of Key Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| State Management | PostgreSQL enum + status field | Type-safe, simple, clear audit trail |
| Balance Transfer | Prisma transaction with increment/decrement | Atomic, follows existing pattern, race-condition safe |
| 70% Validation | Dual validation (approval + withdrawal) | Protects against reserve changes, prevents over-commitment |
| 30-Day Expiration | Date comparison at approval | Simple, no background jobs, clear error message |
| Authorization | JWT user-scoped | Extends existing auth, no additional complexity |
| Audit Trail | Extend AuditEvent pattern | Reuses infrastructure, supports compliance |
| Error Handling | Domain-specific error classes | Clear messages, follows existing pattern |
| API Design | RESTful sub-resource actions | Standard, consistent, clear intent |
| Validation | Zod schemas | Type-safe, extends existing pattern |
| Testing | Integration + unit tests | Comprehensive coverage, follows existing patterns |
| Migration | Prisma schema migration | Safe, tracked, backwards compatible |

---

**Research Complete**: All technical unknowns resolved, ready for Phase 1 (Design & Contracts)
