---

description: "Task list template for feature implementation"
---

# Tasks: Simulacao de Emprestimo com Reserva

**Input**: Design documents from `/specs/001-simulacao-emprestimo-reserva/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED for money-affecting logic (ledger, limits, reserves, loans, simulations).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below assume single project

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create route/controller/service skeletons in `src/routes/loanSimulations.routes.ts`, `src/controllers/loanSimulations.controller.ts`, `src/services/loanSimulationService.ts`
- [X] T002 Create DTO/types definitions in `src/types/loanSimulation.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Update Prisma models in `prisma/schema.prisma` (LoanSimulation, InstallmentPlan, CashFlowImpact, AuditEvent; link to Account emergency_reserve)
- [X] T004 Create migration in `prisma/migrations/` for new simulation models (run `npm run db:migrate`)
- [X] T005 Implement audit event writer in `src/services/AuditEventService.ts`
- [X] T006 Implement Price calculator + rounding in `src/utils/loanSimulationCalculator.ts`
- [X] T007 Add request validation schemas in `src/validators/loanSimulationSchemas.ts`
- [X] T008 Add reserve lookup helper using default account in `src/services/AccountService.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Simular emprestimo com reserva (Priority: P1) MVP

**Goal**: Criar simulacao com parcelas fixas e retornar custo total e impacto mensal

**Independent Test**: POST uma simulacao valida e confirmar parcelas, juros totais e custo total

### Tests for User Story 1 (REQUIRED for money-affecting logic)

- [X] T009 [P] [US1] Unit test do calculo Price em `tests/unit/loanSimulationCalculator.test.ts`
- [X] T010 [P] [US1] Integration test de criacao em `tests/integration/loanSimulations.create.test.ts`

### Implementation for User Story 1

- [X] T011 [US1] Implementar createSimulation em `src/services/loanSimulationService.ts`
- [X] T012 [US1] Persistir audit event de simulacao em `src/services/AuditEventService.ts`
- [X] T013 [US1] Implementar controller POST em `src/controllers/loanSimulations.controller.ts`
- [X] T014 [US1] Expor rota POST em `src/routes/loanSimulations.routes.ts`
- [X] T015 [US1] Registrar rotas em `src/server.ts`
- [X] T016 [US1] Documentar endpoint POST via swagger-jsdoc em `src/routes/loanSimulations.routes.ts`

**Checkpoint**: User Story 1 completa e testavel de forma independente

---

## Phase 4: User Story 2 - Ver impacto na reserva (Priority: P2)

**Goal**: Exibir percentual usado e saldo remanescente da reserva

**Independent Test**: Validar resposta com reserveUsagePercent e reserveRemainingAmount

### Tests for User Story 2 (REQUIRED for money-affecting logic)

- [X] T017 [P] [US2] Unit test do impacto de reserva em `tests/unit/loanSimulationImpact.test.ts`

### Implementation for User Story 2

- [X] T018 [US2] Calcular e incluir impacto na reserva em `src/services/loanSimulationService.ts`
- [X] T019 [US2] Mapear impacto na resposta em `src/controllers/loanSimulations.controller.ts`

**Checkpoint**: User Stories 1 e 2 funcionam de forma independente

---

## Phase 5: User Story 3 - Registrar historico de simulacoes (Priority: P3)

**Goal**: Listar simulacoes e consultar detalhes

**Independent Test**: Listar simulacoes e buscar uma por id

### Tests for User Story 3 (REQUIRED for money-affecting logic)

- [X] T020 [P] [US3] Integration test de listagem em `tests/integration/loanSimulations.list.test.ts`
- [X] T021 [P] [US3] Integration test de detalhe em `tests/integration/loanSimulations.get.test.ts`

### Implementation for User Story 3

- [X] T022 [US3] Implementar list/get em `src/services/loanSimulationService.ts`
- [X] T023 [US3] Implementar endpoints GET em `src/controllers/loanSimulations.controller.ts`
- [X] T024 [US3] Expor rotas GET em `src/routes/loanSimulations.routes.ts`

**Checkpoint**: Todas as user stories funcionam de forma independente

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T025 [P] Atualizar documentacao do recurso em `docs/loan-simulations.md`
- [X] T026 [P] Regenerar OpenAPI em `openapi/openapi.json` via `scripts/generate-openapi-spec.ts`
- [X] T027 [P] Adicionar casos de erro padrao em `src/middlewares/errorHandler.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 -> P2 -> P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 response shape
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on US1 persistence

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Services before controllers
- Controllers before routes
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch unit + integration tests for User Story 1 together:
Task: "Unit test do calculo Price em tests/unit/loanSimulationCalculator.test.ts"
Task: "Integration test de criacao em tests/integration/loanSimulations.create.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Test independently -> Deploy/Demo (MVP!)
3. Add User Story 2 -> Test independently -> Deploy/Demo
4. Add User Story 3 -> Test independently -> Deploy/Demo
5. Each story adds value without breaking previous stories
