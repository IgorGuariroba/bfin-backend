import type { Tag } from "./types.js";

/**
 * Porta de persistência do agregado Tag (ADR-0013). O core só conhece esta
 * interface; quem implementa é um adapter (src/adapters). O contrato é moldado
 * pelo que o service precisa — não é um CRUD genérico.
 */
export interface TagRepo {
  findById(id: string): Promise<Tag | null>;
  /** Busca pelo par único (userId, name). */
  findByName(userId: string, name: string): Promise<Tag | null>;
  /** Contrato de ordenação: system tags primeiro, depois nome ascendente. */
  listByUser(userId: string): Promise<Tag[]>;
  listSystemNames(userId: string): Promise<string[]>;
  create(data: Omit<Tag, "id">): Promise<Tag>;
  /** Cria system tags em lote, ignorando duplicatas (seed idempotente). */
  createSystemTags(
    userId: string,
    tags: readonly { name: string; color: string }[]
  ): Promise<void>;
  update(id: string, patch: { name?: string; color?: string }): Promise<Tag>;
  delete(id: string): Promise<void>;
}
