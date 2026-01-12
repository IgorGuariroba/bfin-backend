import { describe, it, expect } from 'vitest';
import { testRequest, createTestUser, createTestAccount, getAuthHeader } from './helpers';

describe('Categories', () => {
  describe('GET /api/v1/categories', () => {
    it('should list categories without authentication', async () => {
      const response = await testRequest
        .get('/api/v1/categories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter categories by type', async () => {
      const response = await testRequest
        .get('/api/v1/categories?type=expense')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
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
});
