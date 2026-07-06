import type { ApiKeySummary, IssuedApiKey } from "./types.js";

/**
 * Porta de persistência do agregado ApiKey (ADR-0013). Contrato moldado pelo
 * service — não é um CRUD genérico. O core só enxerga hashes; o plain nunca
 * chega ao repo.
 */
export interface ApiKeyRepo {
  /** Ordenação: createdAt desc. */
  listByUser(userId: string): Promise<ApiKeySummary[]>;
  /** Revoga todas as chaves ativas do usuário (invariante: 1 ativa por vez). */
  revokeAllActive(userId: string, at: Date): Promise<void>;
  create(data: {
    userId: string;
    name: string;
    prefix: string;
    hashedKey: string;
  }): Promise<IssuedApiKey>;
  findOwned(
    userId: string,
    id: string,
  ): Promise<{ id: string; revokedAt: Date | null } | null>;
  revoke(id: string, at: Date): Promise<void>;
  findByHashedKey(
    hashedKey: string,
  ): Promise<{ id: string; userId: string; revokedAt: Date | null } | null>;
  bumpLastUsed(id: string, at: Date): Promise<void>;
}
