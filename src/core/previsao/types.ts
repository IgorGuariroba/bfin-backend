// Tipos de domínio próprios (ADR-0013): escritos à mão, não derivados do client
// do ORM. Previsao espelha as colunas persistidas — as rotas serializam estes
// objetos inteiros, então remover campo daqui é breaking change de API.
export interface Previsao {
  id: string;
  userId: string;
  name: string;
  amount: number;
}

/**
 * Usuário que optou pela baixa automática (autoBaixaDiario=true), com os dados
 * de plano crus — quem decide elegibilidade (pro vigente) é o service.
 */
export interface AutoBaixaCandidate {
  userId: string;
  plan: string;
  planExpiresAt: Date | null;
}

/**
 * Placeholder da projeção de gasto diário a persistir (Transaction type=diario,
 * CONTEXT.md › Previsão). id/timestamps/source=manual são responsabilidade do
 * adapter; o type está implícito na porta.
 */
export interface NewDiario {
  userId: string;
  description: string;
  amount: number;
  date: Date;
}
