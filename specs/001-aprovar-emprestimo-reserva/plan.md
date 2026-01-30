# Implementation Plan: Aprovar Simulação de Empréstimo e Retirar da Reserva

**Branch**: `001-aprovar-emprestimo-reserva` | **Date**: 2026-01-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-aprovar-emprestimo-reserva/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature extends the existing loan simulation system to enable users to formally approve simulations and withdraw funds from their emergency reserve into their available balance. The implementation adds approval workflow with state management (não aprovada → aprovada → concluída) and withdrawal execution that transfers funds atomically from emergency reserve to available balance, with dual validation of the 70% reserve limit at both approval and withdrawal stages.

## Technical Context

**Language/Version**: TypeScript (ES2022, CommonJS modules) with Node.js
**Primary Dependencies**:
  - Express.js 4.18.2 (REST API framework)
  - Prisma 7.3.0 (ORM with PostgreSQL adapter)
  - Zod 3.22.4 (schema validation)
  - jsonwebtoken 9.0.2 (JWT authentication)

**Storage**: PostgreSQL via Prisma ORM
  - Transaction management: Prisma `$transaction()` for atomic operations
  - Existing models: User, Account, LoanSimulation, InstallmentPlan, CashFlowImpact, AuditEvent
  - Account balance structure: total_balance = available_balance + locked_balance + emergency_reserve

**Testing**: Vitest 4.0.16 with supertest 7.2.2
  - Integration tests: Full API flow with JWT auth and database
  - Unit tests: Controller mocking with vitest mocks
  - Pattern: beforeEach setup (create user/account/token), afterAll cleanup (cascade deletes)

**Target Platform**: Linux server (containerized with Docker)

**Project Type**: Backend API (single project structure)

**Performance Goals**:
  - Approval: <5 seconds response time (per SC-001)
  - Withdrawal: <3 seconds response time (per SC-004)
  - History query: <2 seconds for 100 simulations (per SC-006)

**Constraints**:
  - 100% transaction atomicity for financial operations (per SC-003, FR-008)
  - Dual validation of 70% reserve limit (approval + withdrawal) (per FR-014, FR-019)
  - Complete audit trail for compliance (per SC-005, FR-010, FR-011)

**Scale/Scope**:
  - Expected: 10k+ users with multiple simulations each
  - Pagination: 50 items per page (existing pattern)
  - State machine: 3 states (não aprovada → aprovada → concluída)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ⚠️ Constitution template not yet ratified - using standard best practices

Since the constitution.md file contains only template placeholders, this check will use industry-standard principles for financial system development:

### Applied Principles

✅ **Transaction Integrity**: All financial operations use Prisma transactions for atomicity
✅ **Audit Trail**: Complete audit logging using existing AuditEventService pattern
✅ **Test-First**: Integration and unit tests required before implementation
✅ **Authorization**: User-scoped operations with JWT authentication
✅ **Error Handling**: Descriptive error messages using existing error handler patterns
✅ **State Management**: Clear state transitions (não aprovada → aprovada → concluída)

### Justifications

**No Complex Patterns**: Using existing service/controller/route patterns - no new abstractions
**No Breaking Changes**: Extends existing LoanSimulation model without affecting current functionality
**Observability**: Follows existing audit event pattern for tracking all operations

**Re-evaluation checkpoint**: After Phase 1 design completion

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── controllers/
│   └── loanSimulations.controller.ts          # Extend with approve/withdraw endpoints
├── services/
│   ├── loanSimulationService.ts               # Extend with approval/withdrawal logic
│   ├── AccountService.ts                       # Existing - used for balance operations
│   └── AuditEventService.ts                    # Existing - used for audit trail
├── routes/
│   └── loanSimulations.routes.ts              # Add POST /:id/approve and /:id/withdraw
├── validators/
│   └── loanSimulationSchemas.ts               # Add approval/withdrawal schemas
├── types/
│   ├── loanSimulation.ts                       # Extend with approval/withdrawal types
│   └── index.ts                                # Export new types
├── middlewares/
│   └── auth.ts                                 # Existing - JWT authentication
└── lib/
    └── prisma.ts                               # Existing - database client

prisma/
└── schema.prisma                               # Extend LoanSimulation model with status fields

tests/
├── integration/
│   ├── loanSimulations.approve.test.ts        # NEW - Approval endpoint tests
│   ├── loanSimulations.withdraw.test.ts       # NEW - Withdrawal endpoint tests
│   ├── loanSimulations.create.test.ts         # Existing - verify no regression
│   ├── loanSimulations.get.test.ts            # Existing - verify status field included
│   └── loanSimulations.list.test.ts           # Existing - verify status filtering
└── unit/
    ├── loanSimulations.controller.test.ts     # Extend with approve/withdraw unit tests
    └── loanSimulationService.test.ts          # NEW - Service logic unit tests
```

**Structure Decision**: Single backend API project following existing Express.js + Prisma architecture. New functionality integrates into existing loan simulation module by extending service, controller, routes, and adding dedicated test files. Database schema extended via Prisma migration. No new modules or packages required - pure extension of existing patterns.

## Complexity Tracking

**Status**: ✅ No violations - all patterns follow existing codebase conventions

**Justification**: Not required - feature extends existing patterns without introducing new complexity:
- Uses existing Prisma transaction pattern
- Follows existing service/controller/route structure
- Reuses authentication and error handling middleware
- Extends existing audit event pattern
- No new abstractions or architectural patterns introduced

---

## Phase 0: Research & Decisions

**Status**: ✅ Complete

**Artifacts**:
- [research.md](./research.md) - All technical decisions documented

**Key Decisions**:
1. State management: PostgreSQL enum with 3 states (PENDING/APPROVED/COMPLETED)
2. Balance transfer: Atomic Prisma transaction with increment/decrement
3. 70% validation: Dual validation at approval and withdrawal
4. 30-day expiration: Date comparison at approval time
5. Authorization: JWT user-scoped (extends existing pattern)
6. Audit trail: Extend existing AuditEvent pattern
7. Error handling: Domain-specific error classes (existing pattern)
8. API design: RESTful sub-resource actions
9. Validation: Zod schemas (extends existing pattern)
10. Testing: Integration + unit tests (existing pattern)
11. Migration: Prisma schema migration with default values

---

## Phase 1: Design & Contracts

**Status**: ✅ Complete

**Artifacts**:
- [data-model.md](./data-model.md) - Database schema and type definitions
- [contracts/api-spec.yaml](./contracts/api-spec.yaml) - OpenAPI specification
- [quickstart.md](./quickstart.md) - Developer quick reference guide

**Design Highlights**:
- **State Machine**: Clear 3-state lifecycle with validation
- **Balance Structure**: Leverages existing account model (no changes needed)
- **Transaction Pattern**: Follows existing service layer atomicity
- **Backwards Compatibility**: All changes are additive, no breaking changes

---

## Phase 2: Implementation Plan

**Ready for**: `/speckit.tasks` - Task generation and decomposition

**Implementation Scope**:

### Database Layer
- ✅ Schema designed (Prisma migration ready)
- ⏳ Execute migration: `npx prisma migrate dev --name add-loan-simulation-status`
- ⏳ Regenerate Prisma client

### Service Layer (`src/services/loanSimulationService.ts`)
- ⏳ Implement `approveSimulation(userId, simulationId)`
  - Validate simulation exists and belongs to user
  - Check status is PENDING
  - Validate 30-day expiration
  - Calculate active loans total
  - Validate 70% reserve limit
  - Update status to APPROVED
  - Create audit event
- ⏳ Implement `withdrawFunds(userId, simulationId)`
  - Validate simulation is APPROVED
  - Validate reserve balance sufficient
  - Revalidate 70% limit
  - Execute atomic transaction (update balances + status)
  - Create audit event
  - Return balance snapshot

### Controller Layer (`src/controllers/loanSimulations.controller.ts`)
- ⏳ Implement `approve(req, res)` endpoint handler
- ⏳ Implement `withdraw(req, res)` endpoint handler
- ⏳ Extend `list(req, res)` to support status filtering
- ⏳ Verify `get(req, res)` includes new status fields

### Routes (`src/routes/loanSimulations.routes.ts`)
- ⏳ Add `POST /:id/approve` route
- ⏳ Add `POST /:id/withdraw` route

### Types (`src/types/loanSimulation.ts`)
- ⏳ Add `LoanSimulationStatus` enum
- ⏳ Extend `LoanSimulationDetails` interface
- ⏳ Extend `LoanSimulationSummary` interface
- ⏳ Add `ApprovalResponse` interface
- ⏳ Add `WithdrawalResponse` interface

### Validation (`src/validators/loanSimulationSchemas.ts`)
- ⏳ Add status enum schema
- ⏳ Add approval response schema
- ⏳ Add withdrawal response schema

### Testing
- ⏳ Integration: `tests/integration/loanSimulations.approve.test.ts`
- ⏳ Integration: `tests/integration/loanSimulations.withdraw.test.ts`
- ⏳ Unit: Extend `tests/unit/loanSimulations.controller.test.ts`
- ⏳ Unit: Create `tests/unit/loanSimulationService.test.ts`
- ⏳ Regression: Verify existing tests still pass

### Documentation
- ⏳ Update Swagger/OpenAPI docs
- ⏳ Regenerate SDK (if using Orval)
- ⏳ Update README (if needed)

---

## Constitution Re-Check (Post-Design)

**Status**: ✅ Passed

**Verification**:
- ✅ No new complex patterns introduced
- ✅ All changes extend existing architecture
- ✅ Test-first approach maintained (tests defined before implementation)
- ✅ Transaction integrity preserved (Prisma transactions)
- ✅ Audit trail complete (AuditEventService)
- ✅ Error handling consistent (existing error classes)
- ✅ Authorization follows existing JWT pattern

**Final Assessment**: Ready for implementation

---

## Dependencies

**Internal**:
- `loanSimulationService` (extend)
- `AccountService.getDefaultEmergencyReserve()` (existing)
- `AuditEventService.writeEvent()` (existing)
- `authenticate` middleware (existing)
- Error handler middleware (existing)

**External**:
- Prisma 7.3.0
- Express.js 4.18.2
- Zod 3.22.4
- jsonwebtoken 9.0.2

**No New Dependencies Required**

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Concurrent withdrawals | HIGH | Prisma transactions with isolation level SERIALIZABLE |
| Reserve balance changes between approval/withdrawal | MEDIUM | Dual validation at both stages |
| Breaking existing functionality | LOW | All changes additive, regression tests |
| Performance degradation | LOW | Indexed queries, same patterns as existing code |
| Data migration issues | LOW | Default values handle existing records automatically |

---

## Success Metrics

**Functional**:
- ✅ All 20 functional requirements (FR-001 through FR-020) implemented
- ✅ All 3 user stories (P1, P2, P3) functional
- ✅ All acceptance scenarios pass

**Performance** (per Success Criteria):
- ⏱️ SC-001: Approval <5 seconds
- ⏱️ SC-004: Withdrawal <3 seconds
- ⏱️ SC-006: History query <2 seconds (100 simulations)

**Quality**:
- 🧪 SC-002: 100% duplicate withdrawal prevention
- 🧪 SC-003: 100% financial integrity (no discrepancies)
- 📊 SC-005: 100% audit coverage
- 📉 SC-007: <0.1% technical error rate
- ✅ SC-008: 95% first-attempt success rate

**Testing**:
- Integration test coverage: >90%
- Unit test coverage: >85%
- All edge cases covered
- Regression tests pass

---

## Next Command

```bash
/speckit.tasks
```

This will generate the detailed task breakdown in `tasks.md` based on this implementation plan.
