import { describe, it, expect } from 'vitest';
import { testRequest, createTestUser, createTestAccount, getAuthHeader } from './helpers';

describe('Accounts', () => {
  describe('GET /api/v1/accounts', () => {
    it('should list user accounts', async () => {
      const { user, tokens } = await createTestUser();
      await createTestAccount(user.id, 'Account 1');
      await createTestAccount(user.id, 'Account 2');

      const response = await testRequest
        .get('/api/v1/accounts')
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should not list accounts without authentication', async () => {
      const response = await testRequest
        .get('/api/v1/accounts')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/accounts/:id', () => {
    it('should get account by id', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const response = await testRequest
        .get(`/api/v1/accounts/${account.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body.id).toBe(account.id);
      expect(response.body.account_name).toBe(account.account_name);
    });

    it('should not get account from another user', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);

      const response = await testRequest
        .get(`/api/v1/accounts/${otherAccount.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent account', async () => {
      const { tokens } = await createTestUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await testRequest
        .get(`/api/v1/accounts/${fakeId}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/accounts', () => {
    it('should create a new account', async () => {
      const { tokens } = await createTestUser();

      const accountData = {
        account_name: 'My Checking Account',
        account_type: 'checking',
        is_default: true,
      };

      const response = await testRequest
        .post('/api/v1/accounts')
        .set(getAuthHeader(tokens.access_token))
        .send(accountData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.account_name).toBe(accountData.account_name);
      expect(response.body.account_type).toBe(accountData.account_type);
      expect(response.body.is_default).toBe(true);
      expect(response.body.total_balance).toBe('0');
    });

    it('should create account with default values', async () => {
      const { tokens } = await createTestUser();

      const response = await testRequest
        .post('/api/v1/accounts')
        .set(getAuthHeader(tokens.access_token))
        .send({
          account_name: 'Simple Account',
        })
        .expect(201);

      expect(response.body.account_type).toBe('checking');
      expect(response.body.currency).toBe('BRL');
    });

    it('should not create account without authentication', async () => {
      const response = await testRequest
        .post('/api/v1/accounts')
        .send({
          account_name: 'Test Account',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should not create account without account_name', async () => {
      const { tokens } = await createTestUser();

      const response = await testRequest
        .post('/api/v1/accounts')
        .set(getAuthHeader(tokens.access_token))
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/v1/accounts/:id', () => {
    it('should update account name', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const response = await testRequest
        .patch(`/api/v1/accounts/${account.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({
          account_name: 'Updated Account Name',
        })
        .expect(200);

      expect(response.body.account_name).toBe('Updated Account Name');
    });

    it('should update is_default flag', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const response = await testRequest
        .patch(`/api/v1/accounts/${account.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({
          is_default: false,
        })
        .expect(200);

      expect(response.body.is_default).toBe(false);
    });

    it('should not update account from another user', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);

      const response = await testRequest
        .patch(`/api/v1/accounts/${otherAccount.id}`)
        .set(getAuthHeader(tokens.access_token))
        .send({
          account_name: 'Hacked Account',
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/v1/accounts/:id', () => {
    it('should delete account with zero balance and no transactions', async () => {
      const { user, tokens } = await createTestUser();
      const account = await createTestAccount(user.id);

      const response = await testRequest
        .delete(`/api/v1/accounts/${account.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should not delete account from another user', async () => {
      const { tokens } = await createTestUser();
      const { user: otherUser } = await createTestUser();
      const otherAccount = await createTestAccount(otherUser.id);

      const response = await testRequest
        .delete(`/api/v1/accounts/${otherAccount.id}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent account', async () => {
      const { tokens } = await createTestUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await testRequest
        .delete(`/api/v1/accounts/${fakeId}`)
        .set(getAuthHeader(tokens.access_token))
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
