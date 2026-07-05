// Tipos de domínio próprios (ADR-0013). As rotas serializam estes objetos
// inteiros — remover campo é breaking change de API. hashedKey nunca sai daqui.
export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

/** Shape devolvido na emissão — o `plain` acompanha só nesse momento. */
export interface IssuedApiKey {
  id: string;
  prefix: string;
  name: string;
  createdAt: Date;
}

/** Principal resolvido de um Bearer token do canal MCP (ADR-0004). */
export interface AgentPrincipal {
  userId: string;
  apiKeyId: string;
}

export type AgentAction = "create" | "update" | "delete";

export interface AgentWrite {
  apiKeyId: string;
  userId: string;
  action: AgentAction;
  entityId: string;
}
