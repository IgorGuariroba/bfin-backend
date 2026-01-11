import { describe, it, expect } from 'vitest';
import { testRequest, createTestUser } from './helpers';

describe('Authentication', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        full_name: 'John Doe',
      };

      const response = await testRequest
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.full_name).toBe(userData.full_name);
      expect(response.body.tokens).toHaveProperty('access_token');
      expect(response.body.tokens).toHaveProperty('refresh_token');
      expect(response.body.tokens).toHaveProperty('expires_in');
    });

    it('should not register user with duplicate email', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        full_name: 'John Doe',
      };

      // Primeiro registro
      await testRequest.post('/api/v1/auth/register').send(userData);

      // Segundo registro com mesmo email
      const response = await testRequest
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('already registered');
    });

    it('should validate required fields', async () => {
      const response = await testRequest
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          // faltando password e full_name
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate email format', async () => {
      const response = await testRequest
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          full_name: 'John Doe',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const { user, password } = await createTestUser();

      const response = await testRequest
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.tokens).toHaveProperty('access_token');
    });

    it('should not login with invalid password', async () => {
      const { user } = await createTestUser();

      const response = await testRequest
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should not login with non-existent email', async () => {
      const response = await testRequest
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const { tokens } = await createTestUser();

      const response = await testRequest
        .post('/api/v1/auth/refresh')
        .send({
          refresh_token: tokens.refresh_token,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('access_token');
      expect(response.body.tokens).toHaveProperty('expires_in');
    });

    it('should not refresh with invalid token', async () => {
      const response = await testRequest
        .post('/api/v1/auth/refresh')
        .send({
          refresh_token: 'invalid-token',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return authenticated user data', async () => {
      const { user, tokens } = await createTestUser();

      const response = await testRequest
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokens.access_token}`)
        .expect(200);

      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe(user.email);
      expect(response.body.full_name).toBe(user.full_name);
    });

    it('should not return data without token', async () => {
      const response = await testRequest
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should not return data with invalid token', async () => {
      const response = await testRequest
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
