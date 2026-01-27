# Implementation Plan: Simulacao de Emprestimo com Reserva

**Branch**: `001-simulacao-emprestimo-reserva` | **Date**: 2026-01-27 | **Spec**: /home/igorguariroba/projetos/bfin/backend/specs/001-simulacao-emprestimo-reserva/spec.md
**Input**: Feature specification from `/specs/001-simulacao-emprestimo-reserva/spec.md`

**Note**: This template is filled in by the planning workflow. If done manually,
replace every placeholder and remove instructional comments.

## Summary

Add internal loan simulation based on the user's emergency reserve, with
validation rules (rate, term, reserve cap), fixed-installment Price calculation,
impact on reserve and monthly cash flow, and simulation history persistence.

## Technical Context

**Language/Version**: TypeScript 5.3 (Node.js 20)  
**Primary Dependencies**: Express.js, Prisma ORM, Zod  
**Storage**: PostgreSQL (via Prisma)  
**Testing**: Vitest (coverage)  
**Target Platform**: Linux server  
**Project Type**: single  
**Performance Goals**: 95% of valid simulations return in <=2s; 99.9% success  
**Constraints**: Offline-first; no external integrations; simulated data isolated  
**Scale/Scope**: Ate 10k usuarios ativos e ate 200 simulacoes por usuario

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Security and privacy controls defined for all sensitive data flows
- Accounting invariants (ledger balance, immutability, reversals) documented
- Audit trail events defined for every financial mutation
- Simulated vs real data separation and labeling confirmed
- Daily limits and reserves enforcement rules captured

**Gate evaluation**: PASS (no violations identified)

**Post-design check**: PASS (data-model and contracts reflect auditability, simulated/real separation, and reserve limits)

## Project Structure

### Documentation (this feature)

```text
specs/001-simulacao-emprestimo-reserva/
├── plan.md              # This file (planning workflow output)
├── research.md          # Phase 0 output (planning workflow)
├── data-model.md        # Phase 1 output (planning workflow)
├── quickstart.md        # Phase 1 output (planning workflow)
├── contracts/           # Phase 1 output (planning workflow)
└── tasks.md             # Phase 2 output (tasks workflow)
```

### Source Code (repository root)

```text
src/
├── controllers/
├── routes/
├── services/
├── models/ (if applicable)
├── types/
├── utils/
└── server.ts

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Single project using existing `src/` layout with
controllers, routes, services, and shared types/utils.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
