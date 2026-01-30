# Data Model: Aprovar Simulação de Empréstimo e Retirar da Reserva

**Date**: 2026-01-28
**Feature**: 001-aprovar-emprestimo-reserva

---

## Overview

This document describes the data model changes required to support loan simulation approval and withdrawal functionality. The design extends the existing `LoanSimulation` model with state management fields while maintaining full backwards compatibility.

---

## Entity: LoanSimulation (Extended)

### Purpose
Tracks loan simulations throughout their complete lifecycle from creation through approval to fund withdrawal.

### State Machine

```
┌─────────────┐
│   PENDING   │ ◄── Initial state (default)
└──────┬──────┘
       │
       │ approve()
       │
       ▼
┌─────────────┐
│  APPROVED   │ ◄── User approved, ready for withdrawal
└──────┬──────┘
       │
       │ withdraw()
       │
       ▼
┌─────────────┐
│  COMPLETED  │ ◄── Funds withdrawn (terminal state)
└─────────────┘
```

### Schema Changes

```prisma
enum LoanSimulationStatus {
  PENDING    // Initial state after creation (maps to "não aprovada")
  APPROVED   // After approval (maps to "aprovada")
  COMPLETED  // After withdrawal (maps to "concluída")
}

model LoanSimulation {
  // ========== EXISTING FIELDS (No changes) ==========
  id                       String   @id @default(uuid())
  user_id                  String
  account_id               String
  principal_amount         Decimal  @db.Decimal(15, 2)
  term_months              Int
  interest_rate_monthly    Decimal  @db.Decimal(7, 4)
  amortization_type        String   @default("PRICE")
  total_interest           Decimal  @db.Decimal(15, 2)
  total_cost               Decimal  @db.Decimal(15, 2)
  installment_amount       Decimal  @db.Decimal(15, 2)
  reserve_usage_percent    Decimal  @db.Decimal(5, 2)
  reserve_remaining_amount Decimal  @db.Decimal(15, 2)
  monthly_cashflow_impact  Decimal  @db.Decimal(15, 2)
  created_at               DateTime @default(now())

  // ========== NEW FIELDS ==========
  status                   LoanSimulationStatus @default(PENDING)
  approved_at              DateTime?
  withdrawn_at             DateTime?

  // ========== EXISTING RELATIONS (No changes) ==========
  user                     User                 @relation(fields: [user_id], references: [id], onDelete: Cascade)
  account                  Account              @relation(fields: [account_id], references: [id], onDelete: Cascade)
  installments             InstallmentPlan[]
  cash_flow                CashFlowImpact?
  audit_events             AuditEvent[]

  @@index([user_id])
  @@index([status])                            // NEW - Performance for status queries
  @@index([user_id, status])                   // NEW - Performance for filtered lists
}
```

### Field Descriptions

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `status` | enum | No | `PENDING` | Current state of simulation lifecycle |
| `approved_at` | DateTime | Yes | null | Timestamp when user approved the simulation |
| `withdrawn_at` | DateTime | Yes | null | Timestamp when funds were withdrawn |

### Validation Rules

**Status Transitions**:
- `PENDING` → `APPROVED`: Valid (via `approve()` operation)
- `APPROVED` → `COMPLETED`: Valid (via `withdraw()` operation)
- `PENDING` → `COMPLETED`: **Invalid** (must approve first)
- Any → `PENDING`: **Invalid** (cannot go backwards)
- `APPROVED` → `APPROVED`: **Invalid** (idempotency not allowed per FR-003)
- `COMPLETED` → any: **Invalid** (terminal state)

**Timestamp Rules**:
- `approved_at` MUST be set when status changes to `APPROVED`
- `withdrawn_at` MUST be set when status changes to `COMPLETED`
- `withdrawn_at` MUST be >= `approved_at` (chronological order)
- `approved_at` MUST be >= `created_at` (cannot approve before creation)

**Business Rules**:
- Age validation: `approved_at` MUST be within 30 days of `created_at` (FR-016)
- Reserve limit: Sum of all `APPROVED` + `COMPLETED` simulations MUST NOT exceed 70% of emergency reserve (FR-014, FR-019)

---

## Entity: Account (Reference - No Changes)

### Relevant Fields for Balance Operations

```prisma
model Account {
  total_balance      Decimal @default(0) @db.Decimal(15, 2)
  available_balance  Decimal @default(0) @db.Decimal(15, 2)
  locked_balance     Decimal @default(0) @db.Decimal(15, 2)
  emergency_reserve  Decimal @default(0) @db.Decimal(15, 2)

  // Invariant: total_balance = available_balance + locked_balance + emergency_reserve
}
```

### Balance Operations

**Withdrawal Transaction** (atomic):
```typescript
// Deduct from emergency reserve
emergency_reserve: { decrement: principal_amount }

// Add to available balance
available_balance: { increment: principal_amount }

// total_balance remains unchanged (internal transfer)
```

---

## Entity: AuditEvent (Reference - No Changes)

### New Event Types

```typescript
// Approval Event
{
  event_type: 'loan_simulation_approved',
  user_id: string,
  account_id: string,
  simulation_id: string,
  payload: {
    principal_amount: number,
    term_months: number,
    reserve_usage_percent: number,
    approved_at: string,            // ISO 8601
    days_since_creation: number,
    reserve_balance_at_approval: number
  }
}

// Withdrawal Event
{
  event_type: 'loan_simulation_withdrawn',
  user_id: string,
  account_id: string,
  simulation_id: string,
  payload: {
    amount: number,
    reserve_balance_before: number,
    reserve_balance_after: number,
    available_balance_before: number,
    available_balance_after: number,
    withdrawn_at: string,           // ISO 8601
    active_loans_total: number
  }
}
```

---

## Type Definitions

### TypeScript Types

```typescript
// Enum mapping
export enum LoanSimulationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED'
}

// Extended simulation details
export interface LoanSimulationDetails extends LoanSimulationResult {
  id: string;
  createdAt: Date;
  status: LoanSimulationStatus;
  approvedAt: Date | null;
  withdrawnAt: Date | null;
}

// Summary for list views
export interface LoanSimulationSummary {
  id: string;
  createdAt: Date;
  amount: number;
  termMonths: number;
  interestRateMonthly: number;
  installmentAmount: number;
  status: LoanSimulationStatus;        // NEW
  approvedAt: Date | null;             // NEW
  withdrawnAt: Date | null;            // NEW
}

// Approval response
export interface ApprovalResponse {
  simulation: LoanSimulationDetails;
  message: string;
}

// Withdrawal response
export interface WithdrawalResponse {
  simulation: LoanSimulationDetails;
  balances: {
    emergencyReserveBefore: number;
    emergencyReserveAfter: number;
    availableBalanceBefore: number;
    availableBalanceAfter: number;
  };
  message: string;
}
```

---

## Query Patterns

### 1. Get Simulation with Status
```typescript
const simulation = await prisma.loanSimulation.findFirst({
  where: {
    id: simulationId,
    user_id: userId
  },
  include: {
    installments: {
      orderBy: { installment_number: 'asc' }
    }
  }
});
```

### 2. List with Status Filtering
```typescript
const simulations = await prisma.loanSimulation.findMany({
  where: {
    user_id: userId,
    status: 'APPROVED'  // Optional filter
  },
  orderBy: { created_at: 'desc' },
  take: limit,
  skip: offset
});
```

### 3. Calculate Active Loans Total
```typescript
const activeLoanTotal = await prisma.loanSimulation.aggregate({
  where: {
    user_id: userId,
    status: { in: ['APPROVED', 'COMPLETED'] }
  },
  _sum: {
    principal_amount: true
  }
});

const total = activeLoanTotal._sum.principal_amount || 0;
```

### 4. Check for Expired Simulations
```typescript
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const expiredCount = await prisma.loanSimulation.count({
  where: {
    user_id: userId,
    status: 'PENDING',
    created_at: { lt: thirtyDaysAgo }
  }
});
```

---

## Migration Script

### Generated Migration (via Prisma)

```sql
-- CreateEnum
CREATE TYPE "LoanSimulationStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED');

-- AlterTable
ALTER TABLE "LoanSimulation"
ADD COLUMN "status" "LoanSimulationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "approved_at" TIMESTAMP,
ADD COLUMN "withdrawn_at" TIMESTAMP;

-- CreateIndex
CREATE INDEX "LoanSimulation_status_idx" ON "LoanSimulation"("status");

-- CreateIndex
CREATE INDEX "LoanSimulation_user_id_status_idx" ON "LoanSimulation"("user_id", "status");
```

### Backwards Compatibility

**Existing Records**:
- All existing `LoanSimulation` records will automatically get `status = 'PENDING'`
- `approved_at` and `withdrawn_at` will be `NULL`
- No data migration needed

**Existing Queries**:
- SELECT queries will include new fields (API clients should ignore unknown fields)
- WHERE clauses without status filtering will continue to work
- New indexes improve performance of existing queries

**Breaking Changes**:
- None - purely additive changes

---

## Indexes

### Performance Considerations

| Index | Purpose | Query Pattern |
|-------|---------|---------------|
| `user_id` | Existing - user-scoped queries | `WHERE user_id = ?` |
| `status` | NEW - status filtering | `WHERE status = ?` |
| `user_id, status` | NEW - combined filter | `WHERE user_id = ? AND status = ?` |
| `created_at` | Implicit - ordering | `ORDER BY created_at DESC` |

**Expected Query Performance**:
- Get by ID: O(1) - Primary key lookup
- List by user: O(log n) - Index scan on `user_id`
- List by user + status: O(log n) - Composite index scan
- Count active loans: O(n) - Aggregate over filtered set (acceptable, small n)

---

## Constraints & Invariants

### Database Constraints (Enforced)

1. **Primary Key**: `id` (UUID, unique, indexed)
2. **Foreign Keys**:
   - `user_id` → `User.id` (CASCADE on delete)
   - `account_id` → `Account.id` (CASCADE on delete)
3. **Not Null**: `status` (has default)
4. **Enum Values**: `status` must be valid `LoanSimulationStatus` value

### Application-Level Invariants (Enforced in Service Layer)

1. **State Transitions**: Only forward transitions allowed (see state machine)
2. **Timestamp Chronology**: `created_at` ≤ `approved_at` ≤ `withdrawn_at`
3. **Approval Age**: `approved_at` - `created_at` ≤ 30 days
4. **Reserve Limit**: Σ(active loans) ≤ 0.70 × `emergency_reserve`
5. **Balance Equation**: `total_balance` = `available_balance` + `locked_balance` + `emergency_reserve`

---

## Summary

### Schema Changes
- ✅ Add `LoanSimulationStatus` enum (3 values)
- ✅ Add `status` field to `LoanSimulation` (default `PENDING`)
- ✅ Add `approved_at` timestamp (nullable)
- ✅ Add `withdrawn_at` timestamp (nullable)
- ✅ Add 2 indexes for performance

### No Changes Required
- ✅ Account model (balance fields already exist)
- ✅ AuditEvent model (flexible JSON payload)
- ✅ InstallmentPlan model
- ✅ CashFlowImpact model

### Backwards Compatibility
- ✅ All existing data automatically gets `PENDING` status
- ✅ No breaking changes to API responses
- ✅ Existing queries continue to work
- ✅ Performance improved with new indexes

### Migration Complexity
- ⭐ **Low** - Single Prisma migration, no data scripts needed
