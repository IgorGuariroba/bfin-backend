export type Plan = "free" | "pro";

/** O que o resolvedor de plano precisa ler do User (ADR-0013: tipos à mão). */
export interface PlanInfo {
  plan: string;
  planExpiresAt: Date | null;
}

/** Dono de uma delegação ativa (ADR-0011), como a UI exibe o "operando como". */
export interface MembershipOwner {
  name: string;
  email: string;
}

export interface DelegationInfo {
  effectiveUserId: string;
  isDelegated: boolean;
  ownerName?: string;
  ownerEmail?: string;
}

// AccountMember espelha as colunas persistidas (ADR-0013) — as rotas de invites
// serializam estes objetos inteiros, então remover campo é breaking change.
export interface AccountMember {
  id: string;
  ownerId: string;
  memberId: string | null;
  inviteEmail: string;
  inviteToken: string;
  role: string;
  status: string;
  createdAt: Date;
}

/** Projeção do convidado anexada a um convite enviado (o que a UI lista). */
export interface InviteMemberProfile {
  name: string;
  email: string;
  image: string | null;
}

/** Projeção do dono anexada a um convite recebido (inclui id para o switch). */
export interface InviteOwnerProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface SentInvite extends AccountMember {
  member: InviteMemberProfile | null;
}

export interface ReceivedInvite extends AccountMember {
  owner: InviteOwnerProfile;
}
