import type { MembersRepo } from "./ports.js";
import type { AccountMember, Plan, ReceivedInvite, SentInvite } from "./types.js";
import { ProRequiredError } from "./service.js";

export class InviteValidationError extends Error {}
export class InviteNotFoundError extends Error {}
/** Convite de outro destinatário — mapeada a 403 na rota. */
export class InviteForbiddenError extends Error {}

export function makeMembersService(
  repo: MembersRepo,
  deps: { getUserPlan(userId: string): Promise<Plan> }
) {
  /** Convidar exige plano pro (gate do compartilhamento de conta). */
  async function createInvite(input: {
    ownerId: string;
    ownerEmail: string | null | undefined;
    email: string;
  }): Promise<AccountMember> {
    const { ownerId, ownerEmail, email } = input;

    if ((await deps.getUserPlan(ownerId)) === "free") {
      throw new ProRequiredError("Convites disponíveis apenas no plano Pro");
    }
    if (!email || typeof email !== "string") {
      throw new InviteValidationError("Email inválido");
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail === ownerEmail?.toLowerCase()) {
      throw new InviteValidationError("Não pode convidar a si mesmo");
    }
    if (await repo.hasPendingOrActiveInvite(ownerId, normalizedEmail)) {
      throw new InviteValidationError("Convite já enviado para este email");
    }

    return repo.createInvite({
      ownerId,
      inviteEmail: normalizedEmail,
      inviteToken: crypto.randomUUID(),
      role: "editor",
      status: "pending",
    });
  }

  /**
   * Aceite do convite: só o destinatário (mesmo email, case-insensitive) pode
   * aceitar, uma única vez — o aceite vincula o membro e ativa a delegação
   * (ADR-0011). Retorna o convite ativado e o dono, para a UI confirmar.
   */
  async function acceptInvite(input: {
    userId: string;
    userEmail: string | null | undefined;
    token: string;
  }): Promise<{ invite: AccountMember; owner: { name: string; email: string } }> {
    const { userId, userEmail, token } = input;

    if (!token || typeof token !== "string") {
      throw new InviteValidationError("Token inválido");
    }

    const invite = await repo.findByToken(token);
    if (!invite) throw new InviteNotFoundError("Convite não encontrado");
    if (invite.status !== "pending") {
      throw new InviteValidationError("Convite já utilizado");
    }
    if (invite.inviteEmail !== userEmail?.toLowerCase()) {
      throw new InviteForbiddenError("Este convite foi enviado para outro email");
    }

    const updated = await repo.activate(invite.id, userId);
    return { invite: updated, owner: invite.owner };
  }

  /**
   * Painel de convites do usuário: enviados (como dono, qualquer status) e
   * recebidos (como convidado, só vínculos ativos).
   */
  async function listInvites(
    userId: string
  ): Promise<{ sent: SentInvite[]; received: ReceivedInvite[] }> {
    const [sent, received] = await Promise.all([
      repo.listSent(userId),
      repo.listReceivedActive(userId),
    ]);
    return { sent, received };
  }

  /** Revoga (deleta) um convite. Anti-IDOR: id de outro dono vira not found. */
  async function revokeInvite(ownerId: string, id: string): Promise<void> {
    const invite = await repo.findById(id);
    if (!invite || invite.ownerId !== ownerId) {
      throw new InviteNotFoundError("Not found");
    }
    await repo.delete(id);
  }

  return { createInvite, acceptInvite, listInvites, revokeInvite };
}

export type MembersService = ReturnType<typeof makeMembersService>;
