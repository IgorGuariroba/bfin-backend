# Phase 0 Research: Simulacao de Emprestimo com Reserva

## Decision: Amortizacao Price (parcelas fixas)
- Rationale: Simplicidade para o usuario, comparacao direta de cenarios e
  alinhamento com praticas comuns de emprestimo pessoal.
- Alternatives considered: SAC (parcelas decrescentes), juros simples.

## Decision: Arredondamento para 2 casas decimais em valores exibidos
- Rationale: Padrao financeiro e reduz discrepancias percebidas pelo usuario.
- Alternatives considered: Manter precisao total, truncamento.

## Decision: Rejeitar simulacao sem reserva cadastrada
- Rationale: Evita simulacao com dado incompleto e reduz risco de decisao errada.
- Alternatives considered: Permitir com reserva zero, permitir com aviso.

## Decision: Simulacoes imutaveis
- Rationale: Rastreabilidade e comparacao historica; evita alteracoes silenciosas.
- Alternatives considered: Edicao completa, edicao parcial do prazo.

## Decision: Parametros de validacao
- Rationale: Garantir consistencia e protecao da reserva.
- Decisions:
  - Taxa de juros padrao: 2.5% ao mes
  - Limite maximo de uso da reserva: 70%
  - Prazo minimo/maximo: 6 a 30 meses
- Alternatives considered: Limites e taxas mais conservadores ou agressivos.

## Decision: Escala alvo inicial
- Rationale: Projeto de financas pessoais com simulacoes internas, sem integracao
  externa; escopo inicial prioriza uso individual.
- Decision: Ate 10k usuarios ativos e ate 200 simulacoes por usuario.
- Alternatives considered: Escala maior, com paginacao e particionamento desde o inicio.
