import type { Transaction, TransactionWithTags } from "./types.js";

/** Intervalo de datas, aberto ou fechado conforme os campos presentes. */
export interface DateRange {
  gte?: Date;
  lt?: Date;
  lte?: Date;
}

export interface TransactionListQuery {
  userId: string;
  type?: string;
  tagId?: string;
  date?: DateRange;
}

/** Campos de uma Transaction nova — id/timestamps são responsabilidade do adapter. */
export interface NewTransaction {
  userId: string;
  type: string;
  description: string;
  amount: number;
  date: Date;
  source: string;
  repeat: string;
  repeatEnd: string;
  repeatCount: number;
}

export interface TransactionPatch {
  type?: string;
  description?: string;
  amount?: number;
  date?: Date;
}

/**
 * Porta de persistência do agregado Transaction (ADR-0013). O core só conhece
 * esta interface; quem implementa é um adapter (src/adapters). O contrato é
 * moldado pelo que o service precisa — não é um CRUD genérico.
 */
export interface TransactionRepo {
  /** Contrato de ordenação: date ascendente. `take` limita o resultado. */
  list(
    query: TransactionListQuery,
    take: number,
  ): Promise<TransactionWithTags[]>;
  /** Candidata a duplicata (ADR-0004): mesmo type+amount na janela; a mais antiga. */
  findDuplicate(
    userId: string,
    type: string,
    amount: number,
    window: { gte: Date; lte: Date },
  ): Promise<TransactionWithTags | null>;
  /** Quantas das tagIds pertencem ao userId — base do anti-IDOR de tags no service. */
  countOwnedTags(userId: string, tagIds: string[]): Promise<number>;
  create(data: NewTransaction, tagIds?: string[]): Promise<TransactionWithTags>;
  /** Cria as ocorrências extras da recorrência, conectando as mesmas tags. */
  createMany(data: NewTransaction[], tagIds?: string[]): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
  /** `tagIds` undefined = não mexe nas tags; [] = desconecta todas (set). */
  update(
    id: string,
    patch: TransactionPatch,
    tagIds?: string[],
  ): Promise<TransactionWithTags>;
  /** Deleta se pertencer ao userId; false quando nada casou (not found ≡ de outro dono). */
  deleteOwned(userId: string, id: string): Promise<boolean>;
}
