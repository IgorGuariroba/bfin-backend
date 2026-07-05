import type { IdentityRepo } from "./ports.js";
import type { DelegationInfo, Plan } from "./types.js";

/** Lançada quando um usuário não-`pro` tenta ligar uma feature exclusiva. Mapeada a 403 na rota. */
export class ProRequiredError extends Error {}

/** Lançada quando uma mutação de User não encontra a linha esperada. */
export class IdentityUserNotFoundError extends Error {}

export function makeIdentityService(repo: IdentityRepo) {
  /**
   * Delegação ADR-0011: membro ativo opera como dono. Resolve o userId efetivo
   * a partir da sessão e do dono pedido (vindo de cookie, lido pelo adapter) —
   * sem vínculo AccountMember ativo, a delegação é ignorada silenciosamente.
   */
  async function resolveEffectiveUser(
    sessionUserId: string,
    requestedOwnerId: string | null | undefined
  ): Promise<string> {
    if (!requestedOwnerId || requestedOwnerId === sessionUserId) return sessionUserId;
    const owner = await repo.findActiveMembershipOwner(requestedOwnerId, sessionUserId);
    return owner ? requestedOwnerId : sessionUserId;
  }

  /** resolveEffectiveUser + dados do dono, para a UI mostrar "operando como". */
  async function getDelegationInfo(
    sessionUserId: string,
    requestedOwnerId: string | null | undefined
  ): Promise<DelegationInfo> {
    if (!requestedOwnerId || requestedOwnerId === sessionUserId) {
      return { effectiveUserId: sessionUserId, isDelegated: false };
    }
    const owner = await repo.findActiveMembershipOwner(requestedOwnerId, sessionUserId);
    if (!owner) return { effectiveUserId: sessionUserId, isDelegated: false };
    return {
      effectiveUserId: requestedOwnerId,
      isDelegated: true,
      ownerName: owner.name,
      ownerEmail: owner.email,
    };
  }

  /**
   * Plano efetivo do usuário. Pro com planExpiresAt no passado conta como free
   * e o downgrade é persistido na hora (lazy) — não há job de expiração.
   * Usuário inexistente é free (fail-closed nos gates).
   */
  async function getUserPlan(userId: string): Promise<Plan> {
    const info = await repo.findPlanInfo(userId);
    if (!info || info.plan !== "pro") return "free";
    if (info.planExpiresAt && info.planExpiresAt < new Date()) {
      await repo.setPlanFree(userId);
      return "free";
    }
    return "pro";
  }

  /**
   * Liga/desliga a "Baixa automática do gasto diário" (ADR-0005). Ligar exige
   * plano `pro`; desligar é sempre permitido (inclusive após downgrade, para o
   * usuário conseguir sair do estado). Idempotente.
   */
  async function setAutoBaixaDiario(userId: string, enabled: boolean): Promise<void> {
    if (enabled && (await getUserPlan(userId)) !== "pro") {
      throw new ProRequiredError("Baixa automática do gasto diário exige plano pro");
    }
    await repo.setAutoBaixaDiario(userId, enabled);
  }

  return { resolveEffectiveUser, getDelegationInfo, getUserPlan, setAutoBaixaDiario };
}

export type IdentityService = ReturnType<typeof makeIdentityService>;
