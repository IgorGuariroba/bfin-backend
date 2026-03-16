import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import prisma from '../../src/lib/prisma';
import { ValidationError, UnauthorizedError } from '../../src/middlewares/errorHandler';
import { AuthService } from '../../src/services/AuthService';

vi.mock('../../src/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    account: {
      create: vi.fn(),
    },
    accountMember: {
      create: vi.fn(),
    },
    financialRule: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  const originalEnv = process.env;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password_hash: 'hashed-password',
    full_name: 'Test User',
    is_active: true,
    created_at: new Date(),
    email_verified: true,
    last_login: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
    service = new AuthService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should throw error when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      expect(() => new AuthService()).toThrow('JWT_SECRET is required');
    });

    it('should throw error when JWT_REFRESH_SECRET is not set', () => {
      delete process.env.JWT_REFRESH_SECRET;
      expect(() => new AuthService()).toThrow('JWT_REFRESH_SECRET is required');
    });

    it('should use default expiration values when not set', () => {
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.JWT_REFRESH_EXPIRES_IN;
      const authService = new AuthService();
      expect(authService).toBeDefined();
    });
  });

  describe('register', () => {
    const registerData = {
      email: 'test@example.com',
      password: 'password123',
      full_name: 'Test User',
    };

    it('should register user successfully', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma as any));
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.account.create).mockResolvedValue({ id: 'account-1' } as any);
      vi.mocked(jwt.sign)
        .mockReturnValueOnce('access-token' as never)
        .mockReturnValueOnce('refresh-token' as never);

      const result = await service.register(registerData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe('test@example.com');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw ValidationError when email is missing', async () => {
      await expect(service.register({ email: '', password: '', full_name: '' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when password is missing', async () => {
      await expect(
        service.register({ email: 'test@example.com', password: '', full_name: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when full_name is missing', async () => {
      await expect(
        service.register({ email: 'test@example.com', password: '', full_name: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid email format', async () => {
      await expect(
        service.register({ email: 'invalid-email', password: 'password123', full_name: 'Test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when password is too short', async () => {
      await expect(
        service.register({ email: 'test@example.com', password: '12345', full_name: 'Test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when email already exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      await expect(service.register(registerData)).rejects.toThrow(ValidationError);
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(jwt.sign)
        .mockReturnValueOnce('access-token' as never)
        .mockReturnValueOnce('refresh-token' as never);

      const result = await service.login(loginData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw ValidationError when email is missing', async () => {
      await expect(service.login({ email: '', password: '' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when password is missing', async () => {
      await expect(service.login({ email: 'test@example.com', password: '' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw UnauthorizedError when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.login(loginData)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when user is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockUser, is_active: false } as any);

      await expect(service.login(loginData)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when password is invalid', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.login(loginData)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockPayload = { userId: 'user-1', email: 'test@example.com' };
      vi.mocked(jwt.verify).mockReturnValue(mockPayload as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(jwt.sign)
        .mockReturnValueOnce('new-access-token' as never)
        .mockReturnValueOnce('new-refresh-token' as never);

      const result = await service.refreshToken('refresh-token');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.id).toBe('user-1');
    });

    it('should throw UnauthorizedError when refresh token is invalid', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when user not found', async () => {
      vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when user is inactive', async () => {
      vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockUser, is_active: false } as any);

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('me', () => {
    it('should return user information', async () => {
      const mockUserSelect = {
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User',
        created_at: new Date(),
        email_verified: true,
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserSelect as any);

      const result = await service.me('user-1');

      expect(result).toEqual(mockUserSelect);
    });

    it('should throw UnauthorizedError when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.me('user-1')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      vi.mocked(jwt.sign)
        .mockReturnValueOnce('access-token' as never)
        .mockReturnValueOnce('refresh-token' as never);

      // Access private method via any cast
      const result = (service as any).generateTokens({
        userId: 'user-1',
        email: 'test@example.com',
      });

      expect(result).toHaveProperty('access_token', 'access-token');
      expect(result).toHaveProperty('refresh_token', 'refresh-token');
      expect(result).toHaveProperty('expires_in');
    });
  });

  describe('parseExpiration', () => {
    it('should parse seconds correctly', () => {
      expect((service as any).parseExpiration('30s')).toBe(30);
    });

    it('should parse minutes correctly', () => {
      expect((service as any).parseExpiration('15m')).toBe(900);
    });

    it('should parse hours correctly', () => {
      expect((service as any).parseExpiration('2h')).toBe(7200);
    });

    it('should parse days correctly', () => {
      expect((service as any).parseExpiration('7d')).toBe(604800);
    });

    it('should return default value for invalid format', () => {
      expect((service as any).parseExpiration('invalid')).toBe(900);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const mockPayload = { userId: 'user-1', email: 'test@example.com' };
      vi.mocked(jwt.verify).mockReturnValue(mockPayload as any);

      const result = service.verifyToken('valid-token');

      expect(result).toEqual(mockPayload);
    });

    it('should throw UnauthorizedError for invalid token', () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => service.verifyToken('invalid-token')).toThrow(UnauthorizedError);
    });
  });
});
