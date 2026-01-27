# Loan Simulations (Reserva de Emergência)

Este recurso permite simular um empréstimo interno usando a reserva de emergência
`accounts.emergency_reserve` da conta padrão do usuário.

## Regras principais

- Amortização: Price (parcelas fixas)
- Taxa padrão: 2.5% ao mês (`0.025`)
- Prazo permitido: 6 a 30 meses
- Uso máximo da reserva: 70%
- Valores monetários são arredondados para 2 casas decimais
- Simulações são imutáveis e auditadas

## Endpoints

Base: `/api/v1/loan-simulations`

### POST /

Cria uma simulação.

Body:

```json
{
  "amount": 500,
  "termMonths": 12,
  "interestRateMonthly": 0.025
}
```

Resposta 201 (campos principais):

- `installmentAmount`
- `totalInterest`
- `totalCost`
- `reserveUsagePercent`
- `reserveRemainingAmount`
- `monthlyCashflowImpact`
- `installmentPlan[]`

Erros comuns:

- 400: payload inválido, prazo fora do range, ou excede 70% da reserva
- 404: conta padrão inexistente

### GET /

Lista simulações do usuário autenticado.

Query:

- `limit` (1-200, opcional)
- `offset` (>=0, opcional)

### GET /:simulationId

Retorna os detalhes de uma simulação específica, incluindo o plano completo de
parcelas.
