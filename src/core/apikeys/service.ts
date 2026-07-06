import type { ApiKeyRepo } from "./ports.js";
import type {
  AgentPrincipal,
  AgentWrite,
  ApiKeySummary,
  IssuedApiKey,
} from "./types.js";
import { ProRequiredError, type Plan } from "../identity/index.js";

export class ApiKeyNotFoundError extends Error {}

/** Material criptográfico de uma chave nova — gerado fora do core (o pepper vem do ambiente). */
export interface GeneratedKey {
  plain: string;
  prefix: string;
  hashedKey: string;
}

/** Observabilidade mínima que o core conhece — o composition root injeta o logger real. */
export interface AgentLogger {
  info(data: Record<string, unknown>, msg: string): void;
  warn(data: Record<string, unknown>, msg: string): void;
}

export interface ApiKeysDeps {
  getUserPlan(userId: string): Promise<Plan>;
  generateKey(): GeneratedKey;
  hashKey(plain: string): string;
  logger: AgentLogger;
}

export function makeApiKeysService(repo: ApiKeyRepo, deps: ApiKeysDeps) {
  /**
   * Emite um ApiKey (feature pro — CONTEXT.md › ApiKey). Invariante: 1 chave
   * ativa por vez — revoga as anteriores antes de criar. O plain é devolvido
   * apenas aqui e nunca mais é recuperável (armazenada hasheada).
   */
  async function issueApiKey(
    userId: string,
  ): Promise<IssuedApiKey & { plain: string }> {
    if ((await deps.getUserPlan(userId)) !== "pro") {
      throw new ProRequiredError("Emissão de token exige plano pro");
    }

    await repo.revokeAllActive(userId, new Date());

    const { plain, prefix, hashedKey } = deps.generateKey();
    const created = await repo.create({
      userId,
      name: "Assistente",
      prefix,
      hashedKey,
    });

    return { ...created, plain };
  }

  /** Chaves do próprio usuário (sem hash), mais recentes primeiro. */
  async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
    return repo.listByUser(userId);
  }

  /**
   * Revoga uma chave. Anti-IDOR: id de outro dono ≡ inexistente. Idempotente —
   * revogar de novo preserva o revokedAt original (trilha de auditoria).
   */
  async function revokeApiKey(userId: string, id: string): Promise<void> {
    const existing = await repo.findOwned(userId, id);
    if (!existing) throw new ApiKeyNotFoundError("Not found");
    if (existing.revokedAt === null) {
      await repo.revoke(id, new Date());
    }
  }

  /**
   * Resolve o principal de um Bearer token do canal MCP (ADR-0004): chave
   * existente, não revogada e de dono pro (downgrade corta o acesso do agente).
   * Sucesso carimba lastUsedAt; falha resolve null sem tocar em nada.
   */
  async function resolvePrincipal(
    token: string,
  ): Promise<AgentPrincipal | null> {
    const record = await repo.findByHashedKey(deps.hashKey(token));
    if (!record || record.revokedAt) return null;

    if ((await deps.getUserPlan(record.userId)) !== "pro") return null;

    await repo.bumpLastUsed(record.id, new Date());

    return { userId: record.userId, apiKeyId: record.id };
  }

  /**
   * Trilha de auditoria de uma escrita do agente (ADR-0004): emite log
   * estruturado (apiKeyId/userId/action/entityId) e carimba ApiKey.lastUsedAt.
   * Como o delete é físico e irreversível, este log é a rede de segurança que
   * torna toda escrita rastreável. Vive fora do transactions-service (que é
   * compartilhado com REST e não conhece ApiKey) — o canal chama após cada
   * create/update/delete.
   */
  async function recordAgentWrite({
    apiKeyId,
    userId,
    action,
    entityId,
  }: AgentWrite): Promise<void> {
    deps.logger.info({ apiKeyId, userId, action, entityId }, "agent write");
    try {
      await repo.bumpLastUsed(apiKeyId, new Date());
    } catch (err) {
      // O bump de lastUsedAt é bookkeeping; a escrita já foi efetivada (o delete
      // é físico e irreversível — ADR-0004). Uma falha aqui não deve estourar
      // para o agente como se a operação tivesse falhado. O log acima já
      // preservou a trilha.
      deps.logger.warn({ apiKeyId, err }, "failed to bump ApiKey.lastUsedAt");
    }
  }

  return {
    issueApiKey,
    listApiKeys,
    revokeApiKey,
    resolvePrincipal,
    recordAgentWrite,
  };
}

export type ApiKeysService = ReturnType<typeof makeApiKeysService>;
