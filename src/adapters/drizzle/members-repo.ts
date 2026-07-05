import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { accountMember, user } from "../../db/schema.js";
import { InviteNotFoundError, type MembersRepo } from "../../core/identity/index.js";
import { newId } from "./id.js";
import { fromDbTimestamp } from "./timestamp.js";

type AccountMemberRow = typeof accountMember.$inferSelect;

function mapRow(row: AccountMemberRow) {
  return { ...row, createdAt: fromDbTimestamp(row.createdAt) };
}

export const drizzleMembersRepo: MembersRepo = {
  listSent: async (ownerId) => {
    const rows = await db
      .select({
        row: accountMember,
        memberName: user.name,
        memberEmail: user.email,
        memberImage: user.image,
      })
      .from(accountMember)
      .leftJoin(user, eq(user.id, accountMember.memberId))
      .where(eq(accountMember.ownerId, ownerId))
      .orderBy(desc(accountMember.createdAt));

    return rows.map((r) => ({
      ...mapRow(r.row),
      member:
        r.memberName !== null && r.memberEmail !== null
          ? { name: r.memberName, email: r.memberEmail, image: r.memberImage }
          : null,
    }));
  },

  listReceivedActive: async (memberId) => {
    const rows = await db
      .select({
        row: accountMember,
        ownerId: user.id,
        ownerName: user.name,
        ownerEmail: user.email,
        ownerImage: user.image,
      })
      .from(accountMember)
      .innerJoin(user, eq(user.id, accountMember.ownerId))
      .where(and(eq(accountMember.memberId, memberId), eq(accountMember.status, "active")))
      .orderBy(desc(accountMember.createdAt));

    return rows.map((r) => ({
      ...mapRow(r.row),
      owner: { id: r.ownerId, name: r.ownerName, email: r.ownerEmail, image: r.ownerImage },
    }));
  },

  hasPendingOrActiveInvite: async (ownerId, inviteEmail) => {
    const [row] = await db
      .select({ id: accountMember.id })
      .from(accountMember)
      .where(
        and(
          eq(accountMember.ownerId, ownerId),
          eq(accountMember.inviteEmail, inviteEmail),
          inArray(accountMember.status, ["pending", "active"])
        )
      )
      .limit(1);
    return row !== undefined;
  },

  createInvite: async (data) => {
    const [row] = await db
      .insert(accountMember)
      .values({ id: newId(), ...data })
      .returning();
    return mapRow(row);
  },

  findByToken: async (token) => {
    const [row] = await db
      .select({
        row: accountMember,
        ownerName: user.name,
        ownerEmail: user.email,
      })
      .from(accountMember)
      .innerJoin(user, eq(user.id, accountMember.ownerId))
      .where(eq(accountMember.inviteToken, token));
    if (!row) return null;
    return { ...mapRow(row.row), owner: { name: row.ownerName, email: row.ownerEmail } };
  },

  activate: async (id, memberId) => {
    const [row] = await db
      .update(accountMember)
      .set({ memberId, status: "active" })
      .where(eq(accountMember.id, id))
      .returning();
    if (!row) throw new InviteNotFoundError(`AccountMember ${id} not found`);
    return mapRow(row);
  },

  findById: async (id) => {
    const [row] = await db.select().from(accountMember).where(eq(accountMember.id, id));
    return row ? mapRow(row) : null;
  },

  delete: async (id) => {
    const deleted = await db
      .delete(accountMember)
      .where(eq(accountMember.id, id))
      .returning({ id: accountMember.id });
    if (deleted.length === 0) throw new InviteNotFoundError(`AccountMember ${id} not found`);
  },
};
