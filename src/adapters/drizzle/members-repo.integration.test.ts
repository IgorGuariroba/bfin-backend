import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { accountMember, user as userTable } from "../../db/schema.js";
import { membersService } from "../index.js";
import { InviteNotFoundError } from "../../core/identity/index.js";
import { drizzleMembersRepo } from "./members-repo.js";
import { trackCreatedUsers } from "./test-helpers.js";

const trackUser = trackCreatedUsers();

async function seedUser(plan = "pro") {
  const [row] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Members User",
      email: `members-${crypto.randomUUID()}@example.com`,
      plan,
    })
    .returning();
  trackUser(row.id);
  return row;
}

describe("members-service fluxo completo", () => {
  it("convida, aceita, lista dos dois lados e revoga", async () => {
    const dono = await seedUser("pro");
    const convidado = await seedUser("free");

    const invite = await membersService.createInvite({
      ownerId: dono.id,
      ownerEmail: dono.email,
      email: convidado.email.toUpperCase(),
    });
    expect(invite).toMatchObject({ status: "pending", inviteEmail: convidado.email });

    const { invite: ativado, owner } = await membersService.acceptInvite({
      userId: convidado.id,
      userEmail: convidado.email,
      token: invite.inviteToken,
    });
    expect(ativado).toMatchObject({ memberId: convidado.id, status: "active" });
    expect(owner.email).toBe(dono.email);

    const doDono = await membersService.listInvites(dono.id);
    expect(doDono.sent).toHaveLength(1);
    expect(doDono.sent[0].member?.email).toBe(convidado.email);

    const doConvidado = await membersService.listInvites(convidado.id);
    expect(doConvidado.received).toHaveLength(1);
    expect(doConvidado.received[0].owner.id).toBe(dono.id);

    await membersService.revokeInvite(dono.id, invite.id);
    expect(
      (await db.select().from(accountMember).where(eq(accountMember.id, invite.id)))[0]
    ).toBeUndefined();
  });

  it("convidado não revoga convite do dono (not found)", async () => {
    const dono = await seedUser("pro");
    const intruso = await seedUser("free");
    const invite = await membersService.createInvite({
      ownerId: dono.id,
      ownerEmail: dono.email,
      email: "alguem@example.com",
    });

    await expect(membersService.revokeInvite(intruso.id, invite.id)).rejects.toBeInstanceOf(
      InviteNotFoundError
    );
  });
});

describe("drizzleMembersRepo", () => {
  it("activate de id inexistente lança InviteNotFoundError (guard de race, não Error genérico)", async () => {
    const convidado = await seedUser();
    await expect(
      drizzleMembersRepo.activate("id-inexistente", convidado.id)
    ).rejects.toBeInstanceOf(InviteNotFoundError);
  });

  it("delete de id inexistente lança InviteNotFoundError (guard de race, não Error genérico)", async () => {
    await expect(drizzleMembersRepo.delete("id-inexistente")).rejects.toBeInstanceOf(
      InviteNotFoundError
    );
  });
});
