import { describe, it, expect } from 'vitest';
import { testRequest, createTestUser, createTestAccount, getAuthHeader } from './helpers';
import prisma from '../lib/prisma';

// Helper functions to reduce duplication
async function setupUserWithAccount() {
  const { user, tokens } = await createTestUser();
  const account = await createTestAccount(user.id);
  return { user, tokens, account };
}

async function createCategoryViaApi(
  token: string,
  accountId: string,
  name: string,
  type: 'expense' | 'income' = 'expense'
) {
  return testRequest
    .post('/api/v1/categories')
    .set(getAuthHeader(token))
    .send({ name, type, account_id: accountId })
    .expect(201);
}

async function createSystemCategoryInDb(name: string) {
  return prisma.category.create({
    data: { name, type: 'expense', is_system: true },
  });
}

describe('Categories', () => {
  describe('GET /api/v1/categories', () => {
    it('should list categories with authentication', async () => {
      const { tokens } = await createTestUser();
      const response = await testRequest
        .get('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .expect(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter categories by type', async () => {
      const { tokens } = await createTestUser();
      const response = await testRequest
        .get('/api/v1/categories?type=expense')
        .set(getAuthHeader(tokens.access_token))
        .expect(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should list categories with account_id (system + custom)', async () => {
      const { tokens, account } = await setupUserWithAccount();
      await createCategoryViaApi(tokens.access_token, account.id, 'Custom Category');

      const response = await testRequest
        .get(`/api/v1/categories?account_id=${account.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.find((c: any) => c.name === 'Custom Category')).toBeDefined();
    });

    it('should not list account categories if account_id is not provided', async () => {
      const { tokens, account } = await setupUserWithAccount();
      await createCategoryViaApi(tokens.access_token, account.id, 'Hidden Category');

      const response = await testRequest
        .get('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.find((c: any) => c.name === 'Hidden Category')).toBeUndefined();
    });

    it('should not list categories with account_id without authentication', async () => {
      const { user } = await createTestUser();
      const account = await createTestAccount(user.id);

      const response = await testRequest
        .get(`/api/v1/categories?account_id=${account.id}`)
        .expect(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should not list categories from account user does not have access to', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);

      const response = await testRequest
        .get(`/api/v1/categories?account_id=${otherAccount.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('should get system category by ID with authentication', async () => {
      const { tokens } = await createTestUser();
      const systemCategory = await createSystemCategoryInDb('System Test Category');

      const response = await testRequest
        .get(`/api/v1/categories/${systemCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.id).toBe(systemCategory.id);
      expect(response.body.is_system).toBe(true);
    });

    it('should get custom category by ID with authentication', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        tokens.access_token,
        account.id,
        'My Category',
        'income'
      );

      const response = await testRequest
        .get(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.id).toBe(createResponse.body.id);
      expect(response.body.name).toBe('My Category');
    });

    it('should not get custom category without authentication', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        tokens.access_token,
        account.id,
        'Private Category'
      );

      const response = await testRequest
        .get(`/api/v1/categories/${createResponse.body.id}`)
        .expect(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should not get category from account user does not have access to', async () => {
      const { tokens } = await createTestUser();
      const { tokens: otherTokens, account: otherAccount } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        otherTokens.access_token,
        otherAccount.id,
        'Other User Category'
      );

      const response = await testRequest
        .get(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent category', async () => {
      const { tokens } = await createTestUser();
      const response = await testRequest
        .get('/api/v1/categories/00000000-0000-0000-0000-000000000000')
        .set(getAuthHeader(tokens.access_token))
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/categories', () => {
    it('should create a category successfully', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const categoryData = {
        name: 'Alimentacao',
        type: 'expense',
        account_id: account.id,
        color: '#FF5733',
        icon: 'food',
      };

      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send(categoryData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(categoryData.name);
      expect(response.body.type).toBe(categoryData.type);
      expect(response.body.color).toBe(categoryData.color);
      expect(response.body.icon).toBe(categoryData.icon);
      expect(response.body.is_system).toBe(false);
    });

    it('should not create category without authentication', async () => {
      const response = await testRequest
        .post('/api/v1/categories')
        .send({ name: 'Test Category', type: 'expense', account_id: 'some-id' })
        .expect(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should not create category without required fields', async () => {
      const { tokens } = await createTestUser();
      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'Test Category' })
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should not create category with invalid type', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'Test Category', type: 'invalid-type', account_id: account.id })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('income');
      expect(response.body.message).toContain('expense');
    });

    it('should not create category for account user does not have access to', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);

      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'Test Category', type: 'expense', account_id: otherAccount.id })
        .expect(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should create income category', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Salario',
          type: 'income',
          account_id: account.id,
          color: '#00FF00',
          icon: 'money',
        })
        .expect(201);
      expect(response.body.type).toBe('income');
    });

    it('should create category without optional fields', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'Simple Category', type: 'expense', account_id: account.id })
        .expect(201);

      expect(response.body.name).toBe('Simple Category');
      expect(response.body.color).toBeNull();
      expect(response.body.icon).toBeNull();
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('should update category successfully', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        tokens.access_token,
        account.id,
        'Original Name'
      );

      const response = await testRequest
        .patch(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'Updated Name', color: '#FF0000', icon: 'party' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.color).toBe('#FF0000');
      expect(response.body.icon).toBe('party');
    });

    it('should update category type from expense to income', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        tokens.access_token,
        account.id,
        'Flexible Category'
      );

      const response = await testRequest
        .patch(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({ type: 'income' })
        .expect(200);
      expect(response.body.type).toBe('income');
    });

    it('should not update category without authentication', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        tokens.access_token,
        account.id,
        'Test Category'
      );

      const response = await testRequest
        .patch(`/api/v1/categories/${createResponse.body.id}`)
        .send({ name: 'Hacked Name' })
        .expect(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should not update system category', async () => {
      const { tokens } = await createTestUser();
      const systemCategory = await createSystemCategoryInDb('System Category To Update');

      const response = await testRequest
        .patch(`/api/v1/categories/${systemCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'Cannot Change' })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('system');
    });

    it('should not update category from account user does not have access to', async () => {
      const { tokens } = await createTestUser();
      const { tokens: otherTokens, account: otherAccount } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        otherTokens.access_token,
        otherAccount.id,
        'Other User Category'
      );

      const response = await testRequest
        .patch(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'Trying to Hack' })
        .expect(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 when updating non-existent category', async () => {
      const { tokens } = await createTestUser();
      const response = await testRequest
        .patch('/api/v1/categories/00000000-0000-0000-0000-000000000000')
        .set(getAuthHeader(tokens.access_token))
        .send({ name: 'New Name' })
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should delete category successfully', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        tokens.access_token,
        account.id,
        'Category To Delete'
      );

      const response = await testRequest
        .delete(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.message).toBe('Category deleted successfully');

      await testRequest
        .get(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(404);
    });

    it('should not delete category without authentication', async () => {
      const { tokens, account } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        tokens.access_token,
        account.id,
        'Category To Delete'
      );

      const response = await testRequest
        .delete(`/api/v1/categories/${createResponse.body.id}`)
        .expect(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should not delete system category', async () => {
      const { tokens } = await createTestUser();
      const systemCategory = await createSystemCategoryInDb('System Category To Delete');

      const response = await testRequest
        .delete(`/api/v1/categories/${systemCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('system');
    });

    it('should not delete category from account user does not have access to', async () => {
      const { tokens } = await createTestUser();
      const { tokens: otherTokens, account: otherAccount } = await setupUserWithAccount();
      const createResponse = await createCategoryViaApi(
        otherTokens.access_token,
        otherAccount.id,
        'Other User Category'
      );

      const response = await testRequest
        .delete(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 when deleting non-existent category', async () => {
      const { tokens } = await createTestUser();
      const response = await testRequest
        .delete('/api/v1/categories/00000000-0000-0000-0000-000000000000')
        .set(getAuthHeader(tokens.access_token))
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});
