import { describe, it, expect } from 'vitest';
import { testRequest, createTestUser, createTestAccount, getAuthHeader } from './helpers';
import prisma from '../lib/prisma';

describe('Account Members', () => {
  describe('GET /api/v1/accounts/:accountId/members', () => {
    it('should list members of an account', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const response = await testRequest
        .get(`/api/v1/accounts/${account.id}/members`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.original_owner_id).toBe(user.id);
      expect(response.body.members).toHaveLength(1); // Only owner initially
      expect(response.body.members[0].user.id).toBe(user.id);
      expect(response.body.members[0].role).toBe('owner');
    });

    it('should fail if user is not a member', async () => {
      const { user: owner } = await createTestUser();
      const account = await createTestAccount(owner.id);

      const { tokens: otherTokens } = await createTestUser();

      await testRequest
        .get(`/api/v1/accounts/${account.id}/members`)
        .set(getAuthHeader(otherTokens.access_token))
        .expect(403);
    });
  });

  describe('Invitations & Membership', () => {
    it('should create an invitation', async () => {
      const { user: owner, tokens: ownerTokens } = await createTestUser();
      const account = await createTestAccount(owner.id);
      const { user: invitee } = await createTestUser();

      const response = await testRequest
        .post(`/api/v1/accounts/${account.id}/invitations`)
        .set(getAuthHeader(ownerTokens.access_token))
        .send({
          email: invitee.email,
          role: 'member',
        })
        .expect(201);

      expect(response.body.invited_email).toBe(invitee.email);
      expect(response.body.status).toBe('pending');
      expect(response.body.token).toBeDefined();
    });

    it('should list invitations for the account (owner)', async () => {
      const { user: owner, tokens: ownerTokens } = await createTestUser();
      const account = await createTestAccount(owner.id);
      const { user: invitee } = await createTestUser();

      await testRequest
        .post(`/api/v1/accounts/${account.id}/invitations`)
        .set(getAuthHeader(ownerTokens.access_token))
        .send({ email: invitee.email, role: 'viewer' })
        .expect(201);

      const response = await testRequest
        .get(`/api/v1/accounts/${account.id}/invitations`)
        .set(getAuthHeader(ownerTokens.access_token))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].invited_email).toBe(invitee.email);
    });

    it('should list my invitations (invitee)', async () => {
      const { user: owner, tokens: ownerTokens } = await createTestUser();
      const account = await createTestAccount(owner.id);
      const { user: invitee, tokens: inviteeTokens } = await createTestUser();

      await testRequest
        .post(`/api/v1/accounts/${account.id}/invitations`)
        .set(getAuthHeader(ownerTokens.access_token))
        .send({ email: invitee.email, role: 'member' })
        .expect(201);

      const response = await testRequest
        .get('/api/v1/invitations/my-invitations')
        .set(getAuthHeader(inviteeTokens.access_token))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].account.id).toBe(account.id);
    });

    it('should accept an invitation', async () => {
      const { user: owner, tokens: ownerTokens } = await createTestUser();
      const account = await createTestAccount(owner.id);
      const { user: invitee, tokens: inviteeTokens } = await createTestUser();

      const inviteRes = await testRequest
        .post(`/api/v1/accounts/${account.id}/invitations`)
        .set(getAuthHeader(ownerTokens.access_token))
        .send({ email: invitee.email, role: 'member' })
        .expect(201);

      const token = inviteRes.body.token;

      const response = await testRequest
        .post(`/api/v1/invitations/${token}/accept`)
        .set(getAuthHeader(inviteeTokens.access_token))
        .expect(200);

      expect(response.body.user_id).toBe(invitee.id);
      expect(response.body.role).toBe('member');

      // Verify member is listed
      const membersRes = await testRequest
        .get(`/api/v1/accounts/${account.id}/members`)
        .set(getAuthHeader(ownerTokens.access_token))
        .expect(200);

      expect(membersRes.body.members).toHaveLength(2);
    });

    it('should reject an invitation', async () => {
      const { user: owner, tokens: ownerTokens } = await createTestUser();
      const account = await createTestAccount(owner.id);
      const { user: invitee, tokens: inviteeTokens } = await createTestUser();

      const inviteRes = await testRequest
        .post(`/api/v1/accounts/${account.id}/invitations`)
        .set(getAuthHeader(ownerTokens.access_token))
        .send({ email: invitee.email, role: 'member' })
        .expect(201);

      const token = inviteRes.body.token;

      const response = await testRequest
        .post(`/api/v1/invitations/${token}/reject`)
        .set(getAuthHeader(inviteeTokens.access_token))
        .expect(200);

      expect(response.body.invitation.status).toBe('rejected');

      // Verify member is NOT listed
      const membersRes = await testRequest
        .get(`/api/v1/accounts/${account.id}/members`)
        .set(getAuthHeader(ownerTokens.access_token))
        .expect(200);

      expect(membersRes.body.members).toHaveLength(1);
    });
  });

  describe('Manage Members', () => {
    it('should update member role', async () => {
      const { user: owner, tokens: ownerTokens } = await createTestUser();
      const account = await createTestAccount(owner.id);
      const { user: member } = await createTestUser();

      // Add member directly via DB for simplicity or use helpers if we had one
      // Using Prisma directly
      await prisma.accountMember.create({
        data: {
          account_id: account.id,
          user_id: member.id,
          role: 'viewer',
        },
      });

      const response = await testRequest
        .put(`/api/v1/accounts/${account.id}/members/${member.id}`)
        .set(getAuthHeader(ownerTokens.access_token))
        .send({ role: 'member' })
        .expect(200);

      expect(response.body.role).toBe('member');
    });

    it('should remove a member', async () => {
      const { user: owner, tokens: ownerTokens } = await createTestUser();
      const account = await createTestAccount(owner.id);
      const { user: member } = await createTestUser();

      await prisma.accountMember.create({
        data: {
          account_id: account.id,
          user_id: member.id,
          role: 'viewer',
        },
      });

      await testRequest
        .delete(`/api/v1/accounts/${account.id}/members/${member.id}`)
        .set(getAuthHeader(ownerTokens.access_token))
        .expect(200);

      // Verify removed
      const memberCheck = await prisma.accountMember.findUnique({
        where: {
          account_id_user_id: {
            account_id: account.id,
            user_id: member.id,
          },
        },
      });
      expect(memberCheck).toBeNull();
    });

    it('should not allow non-owners to manage members', async () => {
      const { user: owner } = await createTestUser();
      const account = await createTestAccount(owner.id);
      const { user: member, tokens: memberTokens } = await createTestUser();
      const { user: other } = await createTestUser();

      await prisma.accountMember.create({
        data: { account_id: account.id, user_id: member.id, role: 'member' },
      });
      await prisma.accountMember.create({
        data: { account_id: account.id, user_id: other.id, role: 'viewer' },
      });

      // Try to update role
      await testRequest
        .put(`/api/v1/accounts/${account.id}/members/${other.id}`)
        .set(getAuthHeader(memberTokens.access_token))
        .send({ role: 'owner' })
        .expect(403);

      // Try to remove member
      await testRequest
        .delete(`/api/v1/accounts/${account.id}/members/${other.id}`)
        .set(getAuthHeader(memberTokens.access_token))
        .expect(403);
    });
  });
});
