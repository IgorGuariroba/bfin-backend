import { describe, it, expect } from 'vitest';
import { testRequest, createTestUser, createTestAccount, getAuthHeader } from './helpers';
import prisma from '../lib/prisma';

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
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      // Criar categoria personalizada
      await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Custom Category',
          type: 'expense',
          account_id: account.id,
        })
        .expect(201);

      const response = await testRequest
        .get(`/api/v1/categories?account_id=${account.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Deve ter categorias do sistema + a personalizada
      const customCategory = response.body.find((c: any) => c.name === 'Custom Category');
      expect(customCategory).toBeDefined();
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

      // Criar categoria do sistema
      const systemCategory = await prisma.category.create({
        data: {
          name: 'System Test Category',
          type: 'expense',
          is_system: true,
        },
      });

      const response = await testRequest
        .get(`/api/v1/categories/${systemCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.id).toBe(systemCategory.id);
      expect(response.body.is_system).toBe(true);
    });

    it('should get custom category by ID with authentication', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'My Category',
          type: 'income',
          account_id: account.id,
        })
        .expect(201);

      const response = await testRequest
        .get(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.id).toBe(createResponse.body.id);
      expect(response.body.name).toBe('My Category');
    });

    it('should not get custom category without authentication', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Private Category',
          type: 'expense',
          account_id: account.id,
        })
        .expect(201);

      const response = await testRequest
        .get(`/api/v1/categories/${createResponse.body.id}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should not get category from account user does not have access to', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser, tokens: otherTokens } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(otherTokens.access_token))
        .send({
          name: 'Other User Category',
          type: 'expense',
          account_id: otherAccount.id,
        })
        .expect(201);

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
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const categoryData = {
        name: 'Alimentação',
        type: 'expense',
        account_id: account.id,
        color: '#FF5733',
        icon: '🍔',
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
        .send({
          name: 'Test Category',
          type: 'expense',
          account_id: 'some-id',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should not create category without required fields', async () => {
      const { tokens } = await createTestUser();

      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Test Category',
          // faltando type e account_id
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should not create category with invalid type', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Test Category',
          type: 'invalid-type',
          account_id: account.id,
        })
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
        .send({
          name: 'Test Category',
          type: 'expense',
          account_id: otherAccount.id,
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should create income category', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Salário',
          type: 'income',
          account_id: account.id,
          color: '#00FF00',
          icon: '💰',
        })
        .expect(201);

      expect(response.body.type).toBe('income');
    });

    it('should create category without optional fields', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const response = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Simple Category',
          type: 'expense',
          account_id: account.id,
        })
        .expect(201);

      expect(response.body.name).toBe('Simple Category');
      expect(response.body.color).toBeNull();
      expect(response.body.icon).toBeNull();
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('should update category successfully', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Original Name',
          type: 'expense',
          account_id: account.id,
        })
        .expect(201);

      const response = await testRequest
        .patch(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Updated Name',
          color: '#FF0000',
          icon: '🎉',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.color).toBe('#FF0000');
      expect(response.body.icon).toBe('🎉');
    });

    it('should update category type from expense to income', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Flexible Category',
          type: 'expense',
          account_id: account.id,
        })
        .expect(201);

      const response = await testRequest
        .patch(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({
          type: 'income',
        })
        .expect(200);

      expect(response.body.type).toBe('income');
    });

    it('should not update category without authentication', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Test Category',
          type: 'expense',
          account_id: account.id,
        })
        .expect(201);

      const response = await testRequest
        .patch(`/api/v1/categories/${createResponse.body.id}`)
        .send({ name: 'Hacked Name' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should not update system category', async () => {
      const { tokens } = await createTestUser();

      const systemCategory = await prisma.category.create({
        data: {
          name: 'System Category To Update',
          type: 'expense',
          is_system: true,
        },
      });

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
      const { user: otherUser, tokens: otherTokens } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(otherTokens.access_token))
        .send({
          name: 'Other User Category',
          type: 'expense',
          account_id: otherAccount.id,
        })
        .expect(201);

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
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Category To Delete',
          type: 'expense',
          account_id: account.id,
        })
        .expect(201);

      const response = await testRequest
        .delete(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.message).toBe('Category deleted successfully');

      // Verificar que foi realmente deletada
      await testRequest
        .get(`/api/v1/categories/${createResponse.body.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(404);
    });

    it('should not delete category without authentication', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(tokens.access_token))
        .send({
          name: 'Category To Delete',
          type: 'expense',
          account_id: account.id,
        })
        .expect(201);

      const response = await testRequest
        .delete(`/api/v1/categories/${createResponse.body.id}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should not delete system category', async () => {
      const { tokens } = await createTestUser();

      const systemCategory = await prisma.category.create({
        data: {
          name: 'System Category To Delete',
          type: 'expense',
          is_system: true,
        },
      });

      const response = await testRequest
        .delete(`/api/v1/categories/${systemCategory.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('system');
    });

    it('should not delete category from account user does not have access to', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser, tokens: otherTokens } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);

      const createResponse = await testRequest
        .post('/api/v1/categories')
        .set(getAuthHeader(otherTokens.access_token))
        .send({
          name: 'Other User Category',
          type: 'expense',
          account_id: otherAccount.id,
        })
        .expect(201);

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
