import { describe, it, expect, beforeEach } from "vitest";
import {
  makeMembersService,
  InviteForbiddenError,
  InviteNotFoundError,
  InviteValidationError,
} from "./members.js";
import { ProRequiredError } from "./service.js";
import type { MembersRepo } from "./ports.js";
import type { AccountMember, Plan } from "./types.js";

// Repo fake em memória: prova que o core é testável sem DB e sem Next (ADR-0013).
interface FakeInvite extends AccountMember {
  ownerProfile: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  memberProfile: { name: string; email: string; image: string | null } | null;
}

function makeFakeRepo() {
  let seq = 0;
  const invites: FakeInvite[] = [];
  const plans = new Map<string, Plan>();

  const byCreatedDesc = (a: FakeInvite, b: FakeInvite) =>
    b.createdAt.getTime() - a.createdAt.getTime();

  const repo: MembersRepo = {
    listSent: async (ownerId) =>
      invites
        .filter((i) => i.ownerId === ownerId)
        .sort(byCreatedDesc)
        .map((i) => ({ ...i, member: i.memberProfile })),
    listReceivedActive: async (memberId) =>
      invites
        .filter((i) => i.memberId === memberId && i.status === "active")
        .sort(byCreatedDesc)
        .map((i) => ({ ...i, owner: i.ownerProfile })),
    hasPendingOrActiveInvite: async (ownerId, inviteEmail) =>
      invites.some(
        (i) =>
          i.ownerId === ownerId &&
          i.inviteEmail === inviteEmail &&
          ["pending", "active"].includes(i.status),
      ),
    createInvite: async (data) => {
      const invite: FakeInvite = {
        id: `inv-${++seq}`,
        memberId: null,
        createdAt: new Date(2026, 0, ++seq),
        ...data,
        ownerProfile: {
          id: data.ownerId,
          name: `Nome ${data.ownerId}`,
          email: `${data.ownerId}@example.com`,
          image: null,
        },
        memberProfile: null,
      };
      invites.push(invite);
      return invite;
    },
    findByToken: async (token) => {
      const invite = invites.find((i) => i.inviteToken === token);
      if (!invite) return null;
      return {
        ...invite,
        owner: {
          name: invite.ownerProfile.name,
          email: invite.ownerProfile.email,
        },
      };
    },
    activate: async (id, memberId) => {
      const invite = invites.find((i) => i.id === id)!;
      invite.memberId = memberId;
      invite.status = "active";
      return invite;
    },
    findById: async (id) => invites.find((i) => i.id === id) ?? null,
    delete: async (id) => {
      const idx = invites.findIndex((i) => i.id === id);
      if (idx >= 0) invites.splice(idx, 1);
    },
  };

  return { repo, invites, plans };
}

let fake: ReturnType<typeof makeFakeRepo>;
let service: ReturnType<typeof makeMembersService>;

beforeEach(() => {
  fake = makeFakeRepo();
  service = makeMembersService(fake.repo, {
    getUserPlan: async (userId) => fake.plans.get(userId) ?? "free",
  });
});

describe("createInvite", () => {
  it("dono pro convida: cria pending/editor com email normalizado e token único", async () => {
    fake.plans.set("dono", "pro");

    const invite = await service.createInvite({
      ownerId: "dono",
      ownerEmail: "dono@example.com",
      email: "  Convidado@Example.com ",
    });

    expect(invite).toMatchObject({
      ownerId: "dono",
      inviteEmail: "convidado@example.com",
      role: "editor",
      status: "pending",
    });
    expect(invite.inviteToken).toBeTruthy();
  });

  it("dono free recebe ProRequiredError", async () => {
    await expect(
      service.createInvite({
        ownerId: "free",
        ownerEmail: "f@x.com",
        email: "a@b.com",
      }),
    ).rejects.toBeInstanceOf(ProRequiredError);
  });

  it("rejeita email ausente ou não-string", async () => {
    fake.plans.set("dono", "pro");

    await expect(
      service.createInvite({
        ownerId: "dono",
        ownerEmail: "d@x.com",
        email: "",
      }),
    ).rejects.toThrow("Email inválido");
    await expect(
      service.createInvite({
        ownerId: "dono",
        ownerEmail: "d@x.com",
        email: 42 as never,
      }),
    ).rejects.toThrow("Email inválido");
  });

  it("rejeita auto-convite (mesmo email do dono, case-insensitive)", async () => {
    fake.plans.set("dono", "pro");

    await expect(
      service.createInvite({
        ownerId: "dono",
        ownerEmail: "Dono@X.com",
        email: "dono@x.com",
      }),
    ).rejects.toThrow("Não pode convidar a si mesmo");
  });

  it("rejeita convite duplicado pending/active para o mesmo email", async () => {
    fake.plans.set("dono", "pro");
    await service.createInvite({
      ownerId: "dono",
      ownerEmail: "d@x.com",
      email: "a@b.com",
    });

    await expect(
      service.createInvite({
        ownerId: "dono",
        ownerEmail: "d@x.com",
        email: "A@B.com ",
      }),
    ).rejects.toThrow("Convite já enviado para este email");
  });
});

describe("acceptInvite", () => {
  async function seedInvite(email = "convidado@example.com") {
    fake.plans.set("dono", "pro");
    return service.createInvite({
      ownerId: "dono",
      ownerEmail: "d@x.com",
      email,
    });
  }

  it("destinatário certo aceita: vira active vinculado ao membro, com dados do dono", async () => {
    const invite = await seedInvite();

    const result = await service.acceptInvite({
      userId: "membro",
      userEmail: "Convidado@Example.com",
      token: invite.inviteToken,
    });

    expect(result.invite).toMatchObject({
      id: invite.id,
      memberId: "membro",
      status: "active",
    });
    expect(result.owner).toEqual({
      name: "Nome dono",
      email: "dono@example.com",
    });
  });

  it("token inválido, inexistente ou convite já utilizado", async () => {
    const invite = await seedInvite();
    await service.acceptInvite({
      userId: "membro",
      userEmail: "convidado@example.com",
      token: invite.inviteToken,
    });

    await expect(
      service.acceptInvite({ userId: "m", userEmail: "a@b.com", token: "" }),
    ).rejects.toBeInstanceOf(InviteValidationError);
    await expect(
      service.acceptInvite({
        userId: "m",
        userEmail: "a@b.com",
        token: "nao-existe",
      }),
    ).rejects.toBeInstanceOf(InviteNotFoundError);
    await expect(
      service.acceptInvite({
        userId: "outro",
        userEmail: "convidado@example.com",
        token: invite.inviteToken,
      }),
    ).rejects.toThrow("Convite já utilizado");
  });

  it("destinatário errado recebe InviteForbiddenError", async () => {
    const invite = await seedInvite();

    await expect(
      service.acceptInvite({
        userId: "intruso",
        userEmail: "intruso@example.com",
        token: invite.inviteToken,
      }),
    ).rejects.toBeInstanceOf(InviteForbiddenError);
  });
});

describe("revokeInvite", () => {
  it("dono revoga; id inexistente ou de outro dono vira not found", async () => {
    fake.plans.set("dono", "pro");
    const invite = await service.createInvite({
      ownerId: "dono",
      ownerEmail: "d@x.com",
      email: "a@b.com",
    });

    await expect(
      service.revokeInvite("intruso", invite.id),
    ).rejects.toBeInstanceOf(InviteNotFoundError);
    await expect(
      service.revokeInvite("dono", "nao-existe"),
    ).rejects.toBeInstanceOf(InviteNotFoundError);

    await service.revokeInvite("dono", invite.id);
    expect(fake.invites).toHaveLength(0);
  });
});

describe("listInvites", () => {
  it("enviados incluem qualquer status; recebidos só os ativos", async () => {
    fake.plans.set("dono", "pro");
    const pendente = await service.createInvite({
      ownerId: "dono",
      ownerEmail: "d@x.com",
      email: "a@b.com",
    });
    const aceito = await service.createInvite({
      ownerId: "dono",
      ownerEmail: "d@x.com",
      email: "membro@example.com",
    });
    await service.acceptInvite({
      userId: "membro",
      userEmail: "membro@example.com",
      token: aceito.inviteToken,
    });

    const doDono = await service.listInvites("dono");
    expect(doDono.sent.map((i) => i.id).sort()).toEqual(
      [pendente.id, aceito.id].sort(),
    );
    expect(doDono.received).toHaveLength(0);

    const doMembro = await service.listInvites("membro");
    expect(doMembro.sent).toHaveLength(0);
    expect(doMembro.received).toHaveLength(1);
    expect(doMembro.received[0].owner).toMatchObject({
      id: "dono",
      email: "dono@example.com",
    });
  });
});
