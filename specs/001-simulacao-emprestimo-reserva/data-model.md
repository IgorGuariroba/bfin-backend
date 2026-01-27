# Data Model: Simulacao de Emprestimo com Reserva

## Entities

### EmergencyReserve
- **Purpose**: Reserva de emergencia do usuario usada como fonte da simulacao.
- **Fields**:
  - id (unique)
  - user_id (owner)
  - currency
  - balance_amount
  - created_at
  - updated_at
- **Rules**:
  - balance_amount >= 0
  - currency required

### LoanSimulation
- **Purpose**: Simulacao de emprestimo com parametros e resultados calculados.
- **Fields**:
  - id (unique)
  - user_id (owner)
  - reserve_id (reference to EmergencyReserve)
  - principal_amount
  - term_months
  - interest_rate_monthly
  - amortization_type (fixed: PRICE)
  - total_interest
  - total_cost
  - installment_amount
  - reserve_usage_percent
  - reserve_remaining_amount
  - monthly_cashflow_impact
  - created_at
- **Rules**:
  - principal_amount > 0
  - term_months between 6 and 30
  - interest_rate_monthly = 2.5% by default
  - reserve_usage_percent <= 70
  - installment_amount, total_interest, total_cost rounded for display to 2 decimals
  - immutable after creation (new simulation for changes)

### InstallmentPlan
- **Purpose**: Serie de parcelas calculadas para a simulacao.
- **Fields**:
  - id (unique)
  - simulation_id (reference to LoanSimulation)
  - installment_number
  - principal_component
  - interest_component
  - total_payment
  - remaining_balance
- **Rules**:
  - installment_number starts at 1 and ends at term_months
  - total_payment equals principal_component + interest_component

### CashFlowImpact
- **Purpose**: Impacto mensal no fluxo de caixa do usuario.
- **Fields**:
  - id (unique)
  - simulation_id (reference to LoanSimulation)
  - monthly_outflow
  - created_at
- **Rules**:
  - monthly_outflow equals installment_amount

## Relationships

- EmergencyReserve 1..1 -> LoanSimulation (by reserve_id)
- LoanSimulation 1..N -> InstallmentPlan
- LoanSimulation 1..1 -> CashFlowImpact

## Lifecycle / State

- LoanSimulation is created and remains immutable; updates create a new record.
