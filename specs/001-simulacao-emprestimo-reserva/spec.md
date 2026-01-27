# Feature Specification: Simulacao de Emprestimo com Reserva

**Feature Branch**: `001-simulacao-emprestimo-reserva`
**Created**: 2026-01-27
**Status**: Draft
**Input**: User description: "Quero uma funcionalidade de simulacao de emprestimo usando a propria reserva de emergencia do usuario como fonte. O fluxo e: o usuario informa quanto quer pegar emprestado, em quantos meses quer pagar, e o app calcula um emprestimo com juros praticados no mercado. Nada fala com banco real, e so simulacao interna. Preciso de regras de validacao (nao pode usar 100% da reserva, definir taxa de juros padrao, prazo minimo e maximo), calculo das parcelas e exibicao do impacto na reserva e no fluxo de caixa mensal. Nao havera integracao externa, apenas endpoints internos no backend e estruturas de dados para registrar as simulacoes."

## Clarifications

### Session 2026-01-27

- Q: Qual modelo de amortizacao deve ser usado no calculo das parcelas? -> A: Parcelas fixas (tabela Price)
- Q: O que fazer quando a reserva de emergencia nao estiver cadastrada? -> A: Rejeitar simulacao sem reserva
- Q: Qual nivel de confiabilidade esperado para as simulacoes? -> A: Alta confiabilidade (99.9% sucesso)
- Q: Como lidar com valores com muitas casas decimais? -> A: Arredondar para 2 casas
- Q: A simulacao pode ser editada apos criada? -> A: Simulacao imutavel (criar nova)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Simular emprestimo com reserva (Priority: P1)

Como usuario, quero informar valor e prazo para simular um emprestimo usando minha
reserva de emergencia, para entender parcelas e impacto no meu caixa mensal.

**Why this priority**: E a funcao principal do pedido e gera valor imediato ao
permitir comparar cenarios de endividamento com a propria reserva.

**Independent Test**: Pode ser testado criando uma simulacao valida com valores
minimos e maximos e verificando parcelas, custo total e impacto mensal.

**Acceptance Scenarios**:

1. **Given** que o usuario tem reserva registrada, **When** informa valor e prazo
   dentro das regras, **Then** o sistema retorna parcelas, juros totais, custo
   total e impacto no fluxo de caixa mensal.
2. **Given** que o usuario tenta usar reserva acima do limite permitido, **When**
   solicita a simulacao, **Then** o sistema rejeita com motivo claro de violacao.

---

### User Story 2 - Ver impacto na reserva (Priority: P2)

Como usuario, quero ver quanto da minha reserva ficaria comprometida pela
simulacao, para decidir se o emprestimo e viavel.

**Why this priority**: Sem essa visibilidade, a simulacao nao ajuda a tomar
uma decisao segura sobre o uso da reserva.

**Independent Test**: Pode ser testado comparando o saldo de reserva atual com o
saldo projetado apos a simulacao, usando um exemplo com numeros simples.

**Acceptance Scenarios**:

1. **Given** uma simulacao valida, **When** consulto o impacto na reserva, **Then**
   vejo o percentual usado e o saldo projetado remanescente.

---

### User Story 3 - Registrar historico de simulacoes (Priority: P3)

Como usuario, quero que as simulacoes fiquem registradas, para comparar e
retomar cenarios anteriores.

**Why this priority**: Historico facilita comparar opcoes e evoluir o planejamento.

**Independent Test**: Pode ser testado criando duas simulacoes e verificando se
ambas aparecem na lista do usuario com seus detalhes principais.

**Acceptance Scenarios**:

1. **Given** simulacoes criadas, **When** consulto o historico, **Then** vejo a
   lista ordenada por data com valores e prazos.

---

### Edge Cases

- O que acontece quando o valor solicitado e zero ou negativo?
- Como o sistema lida com prazo fora do minimo/maximo permitido?
- O que acontece se a reserva do usuario nao estiver cadastrada?
- Como o sistema lida com valores com muitas casas decimais? Arredondar para 2
  casas decimais em valores exibidos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST permitir simulacao informando valor e prazo em meses.
- **FR-002**: System MUST calcular parcelas com juros de mercado e apresentar
  valor da parcela, juros totais e custo total.
- **FR-002a**: System MUST calcular parcelas fixas usando modelo de amortizacao
  Price.
- **FR-002b**: System MUST arredondar valores exibidos para 2 casas decimais.
- **FR-003**: System MUST aplicar limite de uso da reserva abaixo de 100%.
- **FR-004**: System MUST validar prazo minimo e maximo permitidos.
- **FR-005**: System MUST usar uma taxa de juros padrao quando o usuario nao
  informar taxa especifica.
- **FR-006**: System MUST registrar cada simulacao com data, parametros e
  resultados calculados.
- **FR-006a**: System MUST manter simulacoes imutaveis; alteracoes devem criar
  uma nova simulacao.
- **FR-007**: System MUST retornar impacto na reserva (percentual usado e saldo
  projetado remanescente).
- **FR-008**: System MUST retornar impacto no fluxo de caixa mensal do usuario.
- **FR-009**: System MUST rejeitar simulacoes invalidas com motivo claro.
- **FR-009a**: System MUST rejeitar simulacao quando a reserva de emergencia nao
  estiver cadastrada para o usuario.
- **FR-010**: System MUST manter todas as simulacoes como dados internos sem
  integracao externa.
- **FR-011**: System MUST aplicar taxa de juros padrao de 2.5% ao mes.
- **FR-012**: System MUST impor limite maximo de uso da reserva de 70%.
- **FR-013**: System MUST impor prazo minimo de 6 meses e maximo de 30 meses.

### Constitution Alignment (mandatory)

- Security and privacy controls for all sensitive data and auth flows
- Accounting invariants defined (ledger balance, immutability, reversals)
- Audit trail events specified for every financial mutation
- Simulated vs real data separation and labeling clarified
- Daily limits and reserves rules specified and testable

### Key Entities *(include if feature involves data)*

- **EmergencyReserve**: Representa a reserva do usuario, com saldo atual e moeda.
- **LoanSimulation**: Representa uma simulacao com valor, prazo, taxa, datas e
  resultados calculados.
- **InstallmentPlan**: Representa a serie de parcelas calculadas para a simulacao.
- **CashFlowImpact**: Representa o impacto mensal estimado no fluxo de caixa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% das simulacoes validas retornam resultado completo em ate 2
  segundos, medido em horario de pico.
- **SC-002**: 90% dos usuarios conseguem criar uma simulacao valida na primeira
  tentativa sem erros de validacao.
- **SC-003**: 100% das simulacoes registradas aparecem no historico do usuario
  com dados essenciais (valor, prazo, taxa, data).
- **SC-004**: Pelo menos 80% dos usuarios avaliam que a simulacao ajuda a entender
  o impacto na reserva e no caixa mensal.
- **SC-005**: 99.9% das requisicoes validas de simulacao retornam resposta sem
  erros.

## Assumptions

- A reserva de emergencia do usuario ja existe e tem um saldo disponivel.
- A taxa de juros padrao e unica para todos os usuarios, ate ser configurada.
- A simulacao nao gera movimentacao real de dinheiro nem altera saldos reais.
