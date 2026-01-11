import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../services/AuthService';
import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        full_name: 'Test User',
      };

      const result = await authService.register(userData);

      expect(result.user).toHaveProperty('id');
      expect(result.user.email).toBe(userData.email);
      expect(result.user.full_name).toBe(userData.full_name);
      expect(result.tokens).toHaveProperty('access_token');
      expect(result.tokens).toHaveProperty('refresh_token');

      // Verificar se a senha foi hasheada
      const user = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(user?.password_hash).not.toBe(userData.password);
      const isPasswordValid = await bcrypt.compare(
        userData.password,
        user!.password_hash
      );
      expect(isPasswordValid).toBe(true);
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        full_name: 'Test User',
      };

      await authService.register(userData);

      await expect(authService.register(userData)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        full_name: 'Test User',
      };

      await expect(authService.register(userData)).rejects.toThrow();
    });

    it('should validate password minimum length', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: '12345',
        full_name: 'Test User',
      };

      await expect(authService.register(userData)).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const password = 'password123';
      const userData = {
        email: `test${Date.now()}@example.com`,
        password,
        full_name: 'Test User',
      };

      await authService.register(userData);

      const result = await authService.login({
        email: userData.email,
        password,
      });

      expect(result.user.email).toBe(userData.email);
      expect(result.tokens).toHaveProperty('access_token');
      expect(result.tokens).toHaveProperty('refresh_token');
    });

    it('should throw error for invalid email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow();
    });

    it('should throw error for invalid password', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        full_name: 'Test User',
      };

      await authService.register(userData);

      await expect(
        authService.login({
          email: userData.email,
          password: 'wrongpassword',
        })
      ).rejects.toThrow();
    });

    it('should update last_login timestamp', async () => {
      const password = 'password123';
      const userData = {
        email: `test${Date.now()}@example.com`,
        password,
        full_name: 'Test User',
      };

      await authService.register(userData);

      const beforeLogin = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      const lastLoginBefore = beforeLogin?.last_login;

      await authService.login({
        email: userData.email,
        password,
      });

      const afterLogin = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      const lastLoginAfter = afterLogin?.last_login;

      expect(lastLoginAfter).not.toBe(lastLoginBefore);
      expect(lastLoginAfter).toBeInstanceOf(Date);
    });
  });

  describe('generateTokens', () => {
    it('should generate valid JWT tokens', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        full_name: 'Test User',
      };

      const { user } = await authService.register(userData);

      const tokens = authService.generateTokens({
        userId: user.id,
        email: user.email,
      });

      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('refresh_token');
      expect(tokens).toHaveProperty('expires_in');
      expect(typeof tokens.access_token).toBe('string');
      expect(typeof tokens.refresh_token).toBe('string');
      expect(tokens.expires_in).toBe(900); // 15 minutes
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        full_name: 'Test User',
      };

      const { user, tokens } = await authService.register(userData);

      const payload = authService.verifyToken(tokens.access_token);

      expect(payload.userId).toBe(user.id);
      expect(payload.email).toBe(user.email);
    });

    it('should throw error for invalid token', () => {
      expect(() => authService.verifyToken('invalid-token')).toThrow();
    });
  });
});
