// Tipos de domínio próprios (ADR-0013): escritos à mão, não derivados do client
// do ORM. Espelham as colunas persistidas — as rotas serializam estes objetos
// inteiros, então remover campo daqui é breaking change de API.
export interface Transaction {
  id: string;
  userId: string;
  type: string;
  description: string;
  amount: number;
  date: Date;
  repeat: string;
  repeatEnd: string;
  repeatCount: number;
  createdAt: Date;
  updatedAt: Date;
  source: string;
  externalId: string | null;
  pluggyItemId: string | null;
}

/** Projeção de Tag anexada a uma Transaction (o que a UI precisa para renderizar o chip). */
export interface TransactionTag {
  id: string;
  name: string;
  color: string;
}

export interface TransactionWithTags extends Transaction {
  tags: TransactionTag[];
}
