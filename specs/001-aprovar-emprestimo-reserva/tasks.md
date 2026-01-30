# Tasks: Aprovar Simulação de Empréstimo e Retirar da Reserva

**Feature**: 001-aprovar-emprestimo-reserva
**Branch**: `001-aprovar-emprestimo-reserva`
**Input**: Design documents from `/specs/001-aprovar-emprestimo-reserva/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api-spec.yaml, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema migration and type system foundation

- [x] T001 Run Prisma migration to add status enum and fields: `npx prisma migrate dev --name add-loan-simulation-status` in `/prisma/schema.prisma`
- [x] T002 Regenerate Prisma client after migration: `npx prisma generate`
- [x] T003 [P] Add LoanSimulationStatus enum to `/src/types/loanSimulation.ts`
- [x] T004 [P] Extend LoanSimulationDetails interface with status, approvedAt, withdrawnAt in `/src/types/loanSimulation.ts`
- [x] T005 [P] Extend LoanSimulationSummary interface with status fields in `/src/types/loanSimulation.ts`
- [x] T006 [P] Add ApprovalResponse interface to `/src/types/loanSimulation.ts`
- [x] T007 [P] Add WithdrawalResponse interface with balances snapshot to `/src/types/loanSimulation.ts`
- [x] T008 Export all new types from `/src/types/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Add status enum validation schema to `/src/validators/loanSimulationSchemas.ts`
- [x] T010 [P] Add approval response schema to `/src/validators/loanSimulationSchemas.ts`
- [x] T011 [P] Add withdrawal response schema to `/src/validators/loanSimulationSchemas.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Aprovar Simulação de Empréstimo (Priority: P1) 🎯 MVP

**Goal**: Enable users to formally approve loan simulations, changing status from PENDING to APPROVED

**Independent Test**: Create a simulation, call approval endpoint, verify status changes to APPROVED with timestamp

**Acceptance Scenarios**:
1. Approve PENDING simulation → succeeds with status APPROVED
2. Approve non-existent/other user's simulation → 404 error
3. Approve already APPROVED simulation → 400 error
4. Approve simulation >30 days old → 400 error
5. Approve when 70% limit exceeded → 400 error
6. Multiple simulations, approve one → only that one approved

### Implementation for User Story 1

- [x] T012 [US1] Implement `approveSimulation(userId, simulationId)` method in `/src/services/loanSimulationService.ts`:
  - Validate simulation exists and belongs to user (findFirst with user_id)
  - Check status is PENDING (throw ValidationError if not)
  - Validate 30-day expiration (created_at < 30 days ago)
  - Calculate sum of active loans (aggregate where status in APPROVED/COMPLETED)
  - Validate total + new amount ≤ 70% of emergency_reserve
  - Update simulation: status=APPROVED, approved_at=now()
  - Create audit event with type 'loan_simulation_approved'
  - Return LoanSimulationDetails

- [x] T013 [US1] Implement `approve(req, res)` controller method in `/src/controllers/loanSimulations.controller.ts`:
  - Check req.user exists (401 if not)
  - Extract simulationId from req.params.id
  - Call loanSimulationService.approveSimulation(req.user.userId, simulationId)
  - Return 200 with ApprovalResponse { simulation, message }
  - Let error handler middleware catch service errors

- [x] T014 [US1] Add POST `/:id/approve` route to `/src/routes/loanSimulations.routes.ts`:
  - Use authenticate middleware
  - Call controller.approve method
  - Place after existing routes

### Integration Tests for User Story 1

- [x] T015 [P] [US1] Create `/tests/integration/loanSimulations.approve.test.ts`:
  - Setup: Create user, account with emergency_reserve=1000, JWT token
  - Test: POST /api/v1/loan-simulations/:id/approve with valid PENDING simulation → 200, status=APPROVED
  - Test: Approve without auth → 401
  - Test: Approve non-existent simulation → 404
  - Test: Approve already APPROVED simulation → 400
  - Test: Approve simulation created 35 days ago → 400
  - Test: Approve when sum of active loans + new amount > 70% reserve → 400
  - Test: Verify approved_at timestamp is set
  - Test: Verify audit event 'loan_simulation_approved' created
  - Cleanup: Delete audit events, simulations, accounts, users in reverse FK order

**Checkpoint**: At this point, User Story 1 should be fully functional - users can approve simulations with all validations working

---

## Phase 4: User Story 2 - Efetuar Retirada do Valor da Reserva (Priority: P2)

**Goal**: Execute fund withdrawal from emergency reserve to available balance for approved simulations

**Independent Test**: Approve a simulation first, call withdrawal endpoint, verify balances updated and status=COMPLETED

**Acceptance Scenarios**:
1. Withdraw from APPROVED simulation → succeeds, balances updated, status=COMPLETED
2. Withdraw from PENDING simulation → 400 error
3. Withdraw from COMPLETED simulation → 400 error
4. Withdraw when reserve insufficient → 400 error
5. Withdraw when 70% limit exceeded (reserve reduced after approval) → 400 error
6. Transaction failure → rollback, no partial updates

### Implementation for User Story 2

- [x] T016 [US2] Implement `withdrawFunds(userId, simulationId)` method in `/src/services/loanSimulationService.ts`:
  - Execute in prisma.$transaction:
    - Get simulation (findFirst with user_id, include account)
    - Validate status is APPROVED (throw if not)
    - Get account with current balances
    - Validate reserve balance ≥ principal_amount
    - Calculate active loans total (aggregate)
    - Validate total ≤ 70% of current reserve (revalidation)
    - Capture balances before (reserve, available)
    - Update account: emergency_reserve -= amount, available_balance += amount
    - Update simulation: status=COMPLETED, withdrawn_at=now()
    - Create audit event with type 'loan_simulation_withdrawn' including balance snapshot
  - Return WithdrawalResponse { simulation, balances, message }

- [x] T017 [US2] Implement `withdraw(req, res)` controller method in `/src/controllers/loanSimulations.controller.ts`:
  - Check req.user exists (401 if not)
  - Extract simulationId from req.params.id
  - Call loanSimulationService.withdrawFunds(req.user.userId, simulationId)
  - Return 200 with WithdrawalResponse
  - Let error handler middleware catch service errors

- [x] T018 [US2] Add POST `/:id/withdraw` route to `/src/routes/loanSimulations.routes.ts`:
  - Use authenticate middleware
  - Call controller.withdraw method
  - Place after approve route

### Integration Tests for User Story 2

- [x] T019 [P] [US2] Create `/tests/integration/loanSimulations.withdraw.test.ts`:
  - Setup: Create user, account with reserve=1000 available=200, simulation, approve it, JWT token
  - Test: POST /api/v1/loan-simulations/:id/withdraw with APPROVED simulation → 200, status=COMPLETED, balances updated
  - Test: Verify emergency_reserve decreased by principal_amount
  - Test: Verify available_balance increased by principal_amount
  - Test: Withdraw without auth → 401
  - Test: Withdraw from PENDING simulation → 400
  - Test: Withdraw from COMPLETED simulation → 400
  - Test: Withdraw when reserve insufficient (update account reserve to low value first) → 400
  - Test: Withdraw when 70% limit exceeded (reduce reserve after approval) → 400
  - Test: Verify withdrawn_at timestamp set
  - Test: Verify audit event 'loan_simulation_withdrawn' with balance snapshot
  - Test: Transaction rollback on failure (mock Prisma error, verify no partial updates)
  - Cleanup: Delete audit events, simulations, accounts, users

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - full approval → withdrawal flow functional

---

## Phase 5: User Story 3 - Consultar Histórico de Aprovações e Retiradas (Priority: P3)

**Goal**: Provide users with filterable, paginated history of all simulations with status information

**Independent Test**: Create/approve/withdraw several simulations, call list endpoint with status filter, verify results ordered and paginated correctly

**Acceptance Scenarios**:
1. List all simulations → includes status, approvedAt, withdrawnAt fields
2. List filtered by status=APPROVED → only approved simulations returned
3. List with pagination → respects limit/offset parameters
4. User with no simulations → returns empty array
5. Ordered by created_at desc → newest first

### Implementation for User Story 3

- [x] T020 [US3] Extend `listSimulations(userId, limit, offset)` method in `/src/services/loanSimulationService.ts`:
  - Add optional `status?: LoanSimulationStatus` parameter
  - Add status to where clause if provided: `status: status` (in addition to user_id)
  - Return simulations with status, approvedAt, withdrawnAt fields (already in LoanSimulationSummary type)
  - Keep existing orderBy, pagination logic
  - ✅ Already completed in Phase 3 (T012)

- [x] T021 [US3] Extend `list(req, res)` controller method in `/src/controllers/loanSimulations.controller.ts`:
  - Extract status query parameter: `req.query.status`
  - Validate status if provided (must be valid enum value)
  - Pass status to service method
  - Keep existing pagination logic
  - ✅ Already completed in Phase 3 (T013)

- [x] T022 [US3] Update GET `/` route in `/src/routes/loanSimulations.routes.ts`:
  - No changes needed (controller already handles)
  - Verify status query parameter is documented
  - ✅ Added status parameter and response schema documentation

### Integration Tests for User Story 3

- [x] T023 [P] [US3] Extend `/tests/integration/loanSimulations.list.test.ts`:
  - Setup: Create multiple simulations with different statuses (PENDING, APPROVED, COMPLETED)
  - Test: GET /api/v1/loan-simulations → includes status, approvedAt, withdrawnAt in response
  - Test: GET /api/v1/loan-simulations?status=APPROVED → only APPROVED simulations
  - Test: GET /api/v1/loan-simulations?status=COMPLETED → only COMPLETED simulations
  - Test: GET /api/v1/loan-simulations?status=PENDING → only PENDING simulations
  - Test: Invalid status value → 400 error
  - Test: Pagination with status filter → respects limit/offset
  - Test: Order verification → newest first (created_at desc)
  - Cleanup: Delete simulations, accounts, users
  - ✅ All 9 tests passing

- [x] T024 [P] [US3] Extend `/tests/integration/loanSimulations.get.test.ts`:
  - Test: GET /api/v1/loan-simulations/:id → includes status, approvedAt, withdrawnAt
  - Test: Get APPROVED simulation → approvedAt populated, withdrawnAt null
  - Test: Get COMPLETED simulation → both timestamps populated
  - Test: Get PENDING simulation → both timestamps null
  - ✅ All 5 tests passing

**Checkpoint**: All user stories should now be independently functional - complete approval, withdrawal, and history features working

---

## Phase 6: Unit Tests & Code Quality

**Purpose**: Add unit test coverage for business logic isolation

- [x] T025 [P] Extend `/tests/unit/loanSimulations.controller.test.ts`:
  - Mock loanSimulationService.approveSimulation
  - Test: controller.approve calls service with correct userId and simulationId
  - Test: controller.approve returns 200 with simulation data
  - Test: controller.approve returns 401 if no req.user
  - Mock loanSimulationService.withdrawFunds
  - Test: controller.withdraw calls service with correct params
  - Test: controller.withdraw returns 200 with withdrawal response
  - Test: controller.withdraw returns 401 if no req.user

- [x] T026 [P] Create `/tests/unit/loanSimulationService.test.ts`:
  - Mock Prisma client
  - Test: approveSimulation validates user ownership
  - Test: approveSimulation checks 30-day expiration
  - Test: approveSimulation validates 70% limit with active loans
  - Test: approveSimulation updates status and timestamp
  - Test: withdrawFunds validates status is APPROVED
  - Test: withdrawFunds revalidates 70% limit
  - Test: withdrawFunds updates balances atomically
  - Test: withdrawFunds creates audit events

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, regression verification, and deployment readiness

- [x] T027 [P] Run all existing loan simulation tests to verify no regressions:
  - `/tests/integration/loanSimulations.create.test.ts`
  - `/tests/integration/loanSimulations.get.test.ts`
  - `/tests/integration/loanSimulations.list.test.ts`
  - Verify: All tests pass without modifications
  - Verify: New status fields appear in responses but don't break existing functionality

- [x] T028 [P] Update Swagger/OpenAPI documentation in `/src/config/swagger.ts`:
  - Add approval endpoint documentation
  - Add withdrawal endpoint documentation
  - Extend simulation response schemas with status fields
  - Document error responses for each endpoint

- [x] T029 [P] Regenerate SDK if using Orval: `npm run sdk:generate` (check `package.json` for actual command)

- [x] T030 [P] Validate quickstart.md examples in `/specs/001-aprovar-emprestimo-reserva/quickstart.md`:
  - Run curl examples manually
  - Verify all responses match documented examples
  - Update any discrepancies

- [x] T031 Run complete test suite: `npm test`
  - Verify: All new tests pass
  - Verify: All existing tests pass
  - Verify: Coverage meets project standards

- [x] T032 Run linting and formatting: `npm run lint && npm run format`

- [x] T033 Commit implementation with conventional commit message: `feat(loan): add approval and withdrawal workflow`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Unit Tests (Phase 6)**: Can run in parallel with Phase 7 after user stories complete
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 but independently testable (just needs to approve first in tests)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Reads data created by US1/US2 but independently testable

### Within Each User Story

- Service implementation before controller
- Controller before route
- Route before integration tests (or write tests first for TDD)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**: All tasks T003-T007 marked [P] can run in parallel (different type definitions)

**Phase 2 (Foundational)**: Tasks T010-T011 marked [P] can run in parallel (different schema files)

**Once Foundational completes**: All three user stories can start in parallel if team capacity allows
- Developer A: User Story 1 (T012-T015)
- Developer B: User Story 2 (T016-T019)
- Developer C: User Story 3 (T020-T024)

**Phase 6 (Unit Tests)**: Tasks T025-T026 marked [P] can run in parallel (different test files)

**Phase 7 (Polish)**: Tasks T027-T030 marked [P] can run in parallel (different concerns)

---

## Parallel Example: User Story 1

```bash
# After foundational phase completes, can launch:
Task T012: "Implement approveSimulation service method"
# In parallel with:
Task T013: "Implement approve controller method" (depends on T012 completing first)
# Then:
Task T014: "Add approve route"
# Finally in parallel:
Task T015: "Create integration tests for approval"
```

## Parallel Example: All User Stories After Foundation

```bash
# Once Phase 2 (Foundational) completes, launch all in parallel:
Team Member 1 → Phase 3 (US1): T012-T015
Team Member 2 → Phase 4 (US2): T016-T019
Team Member 3 → Phase 5 (US3): T020-T024
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T011) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T012-T015)
4. **STOP and VALIDATE**:
   - Run integration tests: `npm test tests/integration/loanSimulations.approve.test.ts`
   - Manual test: Create sim → Approve → Verify status=APPROVED
   - Check audit events in database
5. Deploy/demo MVP (approval feature working)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP - Approval working!)
3. Add User Story 2 → Test independently → Deploy/Demo (Full workflow - Approval + Withdrawal!)
4. Add User Story 3 → Test independently → Deploy/Demo (Complete feature - History included!)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With 3 developers after Foundational phase:

1. All devs complete Phases 1-2 together (T001-T011)
2. Once Foundational done, split:
   - **Dev A**: User Story 1 (T012-T015) - Approval
   - **Dev B**: User Story 2 (T016-T019) - Withdrawal
   - **Dev C**: User Story 3 (T020-T024) - History
3. Stories complete independently, integrate seamlessly
4. Converge for Phase 6-7 (Unit tests + Polish)

---

## Task Summary

**Total Tasks**: 33

**By Phase**:
- Phase 1 (Setup): 8 tasks
- Phase 2 (Foundational): 3 tasks
- Phase 3 (US1 - Approval): 4 tasks (1 service, 1 controller, 1 route, 1 integration test file)
- Phase 4 (US2 - Withdrawal): 4 tasks (1 service, 1 controller, 1 route, 1 integration test file)
- Phase 5 (US3 - History): 4 tasks (1 service extension, 1 controller extension, 1 route verify, 2 test file extensions)
- Phase 6 (Unit Tests): 2 tasks
- Phase 7 (Polish): 7 tasks

**By User Story**:
- US1 (Approval): 4 tasks
- US2 (Withdrawal): 4 tasks
- US3 (History): 4 tasks
- Infrastructure: 21 tasks (setup, foundational, tests, polish)

**Parallel Opportunities**: 13 tasks marked [P] can run in parallel within their phases

**Independent Test Criteria**:
- **US1**: Create simulation → Call approve → Status=APPROVED ✓
- **US2**: Approve simulation → Call withdraw → Balances updated, Status=COMPLETED ✓
- **US3**: Create/approve/withdraw multiple → List with filters → Correct results ✓

**MVP Scope**: Phases 1-3 (Tasks T001-T015) = 15 tasks for core approval feature

---

## Notes

- [P] tasks = different files, no direct dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Stop at any checkpoint to validate story independently
- All file paths are absolute from repository root
- Follow existing codebase patterns (Prisma transactions, error handlers, auth middleware)
- Use existing test patterns (beforeEach setup, afterAll cleanup)
- Atomic transactions for all financial operations (SC-003, FR-008)
- Complete audit trail (SC-005, FR-010, FR-011)
- Dual validation of 70% limit (FR-014, FR-019)
