<!--
Sync Impact Report
- Version change: N/A (template) -> 1.0.0
- Modified principles:
  - placeholder PRINCIPLE_1_NAME -> I. Seguranca e Privacidade Fortes
  - placeholder PRINCIPLE_2_NAME -> II. Consistencia Contabil Inviolavel
  - placeholder PRINCIPLE_3_NAME -> III. Rastreabilidade Total e Auditavel
  - placeholder PRINCIPLE_4_NAME -> IV. Separacao Estrita entre Simulado e Real
  - placeholder PRINCIPLE_5_NAME -> V. Limites Diarios e Reservas Enforcados
- Added sections: Requisitos de Dominio e Dados; Fluxo de Desenvolvimento e Qualidade
- Removed sections: none
- Templates requiring updates:
  - .specify/templates/plan-template.md updated
  - .specify/templates/spec-template.md updated
  - .specify/templates/tasks-template.md updated
- Follow-up TODOs: TODO(RATIFICATION_DATE) - data de ratificacao original nao informada
-->
# Limiti Diario Constitution
<!-- Example: Spec Constitution, TaskFlow Constitution, etc. -->

## Core Principles

### I. Seguranca e Privacidade Fortes
Todos os dados financeiros, pessoais e de autenticacao DEVEM ser protegidos com
controles proporcionais ao risco: criptografia em repouso e em transito, segredos
geridos fora do codigo, validacao de entrada estrita e menor privilegio. O app
NAO integra com bancos; qualquer importacao deve ser manual e tratada como dado
nao confiavel. Nao armazenar informacoes sensiveis desnecessarias. Racional: um
app financeiro pessoal exige confianca e reduzicao maxima de exposicao.

### II. Consistencia Contabil Inviolavel
Toda movimentacao deve ser registrada em um ledger imutavel e balanceado, com
invariantes contabilizaveis (ex.: debito/credito somando zero). Saldos sao
derivados do ledger, nao editados diretamente. Correcoes devem ser feitas por
estornos/ajustes rastreaveis, nunca por edicao destrutiva. Racional: evita
inconsistencias e garante confiabilidade dos calculos e simulacoes.

### III. Rastreabilidade Total e Auditavel
Toda alteracao em dados financeiros (lancamentos, emprestimos, reservas, limites,
simulacoes) DEVE gerar eventos de auditoria imutaveis com quem/quando/o-que/por
que, correlacao de requisicao e origem. Nao pode haver atualizacoes silenciosas.
Racional: possibilita auditoria, depuracao e confianca do usuario.

### IV. Separacao Estrita entre Simulado e Real
Dados simulados (cenarios, emprestimos hipoteticos, reservas planejadas) DEVEM
ser segregados de dados reais e nunca misturados por padrao. Interfaces devem
rotular claramente o que e simulado vs. real, e qualquer consolidacao deve ser
explicitamente opt-in. Racional: evita confusao do usuario e erros decisorios.

### V. Limites Diarios e Reservas Enforcados
Limites diarios e reservas (ex.: poupanca, emergencias) DEVEM ser aplicados por
regra antes de confirmar qualquer lancamento real ou simulado, com rejeicao
explicita em caso de violacao. Registros devem explicar o motivo da rejeicao.
Racional: protege o usuario contra extrapolacoes e melhora o planejamento.

## Requisitos de Dominio e Dados
- O sistema e offline-first para dados financeiros: sem integracao bancaria e
  sem dependencia de terceiros para calcular saldos.
- Importacoes sao manuais e devem ser validas, idempotentes e auditaveis.
- Todo modelo financeiro precisa de identificadores estaveis e timestamps
  imutaveis (criado_em, atualizado_em).
- As regras de emprestimos (juros, parcelas, amortizacao) devem ser deterministas
  e reproduziveis a partir do ledger e dos parametros salvos.

## Fluxo de Desenvolvimento e Qualidade
- Mudancas em regras financeiras exigem testes automatizados cobrindo invariantes
  contabilizaveis e cenarios de limites/ reservas.
- Qualquer alteracao que toque dados financeiros deve atualizar os eventos de
  auditoria e a documentacao de modelos (spec e data-model).
- Revisoes de PR devem verificar conformidade com todos os principios e apontar
  qualquer excecao explicitamente.

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

Esta constituicao prevalece sobre templates, scripts e guias. Emendas exigem:
descricao da mudanca, impacto nos principios, e atualizacao de templates
dependentes. Versionamento segue SemVer: MAJOR para mudancas incompativeis ou
remocao/alteracao de principios; MINOR para novos principios ou expansoes
materiais; PATCH para ajustes editoriais. Toda PR deve incluir uma checagem
explicita de conformidade com os principios (seguranca, consistencia contabil,
rastreabilidade, separacao simulado/real, limites/reservas).

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): data original nao informada | **Last Amended**: 2026-01-27
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->
