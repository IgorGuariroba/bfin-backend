# Quickstart: Simulacao de Emprestimo com Reserva

## Goal
Criar uma simulacao de emprestimo usando a reserva de emergencia e consultar o
historico de simulacoes.

## Prerequisites
- Ambiente local configurado
- Reserva de emergencia cadastrada para o usuario
- Usuario autenticado

## Run (dev)
1. Inicie os servicos locais e o servidor.
2. Execute uma simulacao com valor e prazo validos.
3. Consulte o historico de simulacoes.

## Example Flow

### 1) Criar simulacao
- Input: valor, prazo em meses (taxa opcional)
- Output: parcelas fixas (Price), juros totais, custo total, impacto na reserva e no caixa mensal

### 2) Listar simulacoes
- Output: lista ordenada por data com valor, prazo e parcela

### 3) Consultar simulacao
- Output: detalhes completos com plano de parcelas

## Expected Results
- Simulacao rejeitada se reserva inexistente ou limite de 70% for excedido
- Prazos fora de 6-30 meses sao rejeitados
- Valores exibidos com 2 casas decimais
