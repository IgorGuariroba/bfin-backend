import { describe, it, expect, beforeEach } from 'vitest';
import { testRequest, createTestUser, createTestAccount, getAuthHeader } from './helpers';
import prisma from '../lib/prisma';

async function createTestCategory(
  accountId: string,
  name = 'Test Category',
  type: 'income' | 'expense' = 'expense'
) {
  return await prisma.category.create({
    data: {
      account_id: accountId,
      name,
      type,
      is_system: false,
    },
  });
}

async function createSystemCategory(
  name = 'System Category',
  type: 'income' | 'expense' = 'expense'
) {
  return await prisma.category.create({
    data: {
      name,
      type,
      is_system: true,
    },
  });
}

describe('Categories CRUD', () => {
  let systemCategory: any;

  beforeEach(async () => {
    systemCategory = await createSystemCategory();
  });

  describe('GET /api/v1/categories (List)', () => {
    it('should list system categories and account categories when account_id is provided', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const customCategory = await createTestCategory(account.id, 'My Custom Cat');

      const response = await testRequest
        .get(`/api/v1/categories?account_id=${account.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      const ids = response.body.map((c: any) => c.id);
      expect(ids).toContain(customCategory.id);
      expect(ids).toContain(systemCategory.id);
    });

    it('should NOT list account categories if account_id is NOT provided', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const customCategory = await createTestCategory(account.id, 'Hidden Custom Cat');

      const response = await testRequest
        .get('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      const ids = response.body.map((c: any) => c.id);
      expect(ids).not.toContain(customCategory.id);
      expect(ids).toContain(systemCategory.id);
    });

    it('should return 403 if user has no access to account', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);

      await testRequest
        .get(`/api/v1/categories?account_id=${otherAccount.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('should get system category details with authentication', async () => {
      const { tokens } = await createTestUser();

      const response = await testRequest
        .get(`/api/v1/categories/${systemCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.id).toBe(systemCategory.id);
    });

    it('should get own custom category', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const customCategory = await createTestCategory(account.id);

      const response = await testRequest
        .get(`/api/v1/categories/${customCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.id).toBe(customCategory.id);
    });

    it('should fail to get other user custom category', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);
      const otherCategory = await createTestCategory(otherAccount.id);

      await testRequest
        .get(`/api/v1/categories/${otherCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('should update own custom category', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id, 'Old Name');

      const response = await testRequest
        .patch(`/api/v1/categories/${category.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'New Name' })
        .expect(200);

      expect(response.body.name).toBe('New Name');

      // Verify in DB
      const dbCat = await prisma.category.findUnique({ where: { id: category.id } });
      expect(dbCat?.name).toBe('New Name');
    });

    it('should NOT update system category', async () => {
      const { tokens } = await createTestUser();

      await testRequest
        .patch(`/api/v1/categories/${systemCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('should NOT update other user category', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);
      const otherCategory = await createTestCategory(otherAccount.id);

      await testRequest
        .patch(`/api/v1/categories/${otherCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'Hacked Name' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should delete own custom category', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);
      const category = await createTestCategory(account.id);

      await testRequest
        .delete(`/api/v1/categories/${category.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      const dbCat = await prisma.category.findUnique({ where: { id: category.id } });
      expect(dbCat).toBeNull();
    });

    it('should NOT delete system category', async () => {
      const { tokens } = await createTestUser();

      await testRequest
        .delete(`/api/v1/categories/${systemCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);
    });

    it('should NOT delete other user category', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);
      const otherCategory = await createTestCategory(otherAccount.id);

      await testRequest
        .delete(`/api/v1/categories/${otherCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);
    });
  });
});
