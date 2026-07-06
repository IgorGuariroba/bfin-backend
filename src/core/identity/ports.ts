import type {
  AccountMember,
  MembershipOwner,
  PlanInfo,
  ReceivedInvite,
  SentInvite,
} from "./types.js";

/**
 * Porta de persistência do agregado Identidade (ADR-0013). O contrato é
 * moldado pelo que o service precisa — não é um CRUD genérico.
 */
export interface IdentityRepo {
  /** null quando o usuário não existe. */
  findPlanInfo(userId: string): Promise<PlanInfo | null>;
  /** Downgrade persistente do pro vencido (getUserPlan é quem decide). */
  setPlanFree(userId: string): Promise<void>;
  setAutoBaixaDiario(userId: string, enabled: boolean): Promise<void>;
  /**
   * Dono da delegação quando existe AccountMember ativo ownerId←memberId
   * (ADR-0011); null quando não há vínculo ativo.
   */
  findActiveMembershipOwner(
    ownerId: string,
    memberId: string,
  ): Promise<MembershipOwner | null>;
}

/** Campos de um convite novo — id/createdAt são responsabilidade do adapter. */
export interface NewInvite {
  ownerId: string;
  inviteEmail: string;
  inviteToken: string;
  role: string;
  status: string;
}

/**
 * Porta do ciclo de vida do AccountMember (convite → aceite → revogação).
 * Contrato moldado pelo service — não é um CRUD genérico.
 */
export interface MembersRepo {
  /** Convites enviados pelo dono, qualquer status. Ordenação: createdAt desc. */
  listSent(ownerId: string): Promise<SentInvite[]>;
  /** Vínculos ativos onde o usuário é o convidado. Ordenação: createdAt desc. */
  listReceivedActive(memberId: string): Promise<ReceivedInvite[]>;
  /** Já existe convite pending/active do dono para este email? (dedup do invite) */
  hasPendingOrActiveInvite(
    ownerId: string,
    inviteEmail: string,
  ): Promise<boolean>;
  createInvite(data: NewInvite): Promise<AccountMember>;
  findByToken(
    token: string,
  ): Promise<
    (AccountMember & { owner: { name: string; email: string } }) | null
  >;
  /** Vincula o convidado e ativa o convite. */
  activate(id: string, memberId: string): Promise<AccountMember>;
  findById(id: string): Promise<AccountMember | null>;
  delete(id: string): Promise<void>;
}
