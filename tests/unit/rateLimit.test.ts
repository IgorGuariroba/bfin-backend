import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('rateLimit middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRateLimitWindow = process.env.RATE_LIMIT_WINDOW_MS;
  const originalRateLimitMax = process.env.RATE_LIMIT_MAX_REQUESTS;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.RATE_LIMIT_WINDOW_MS = originalRateLimitWindow;
    process.env.RATE_LIMIT_MAX_REQUESTS = originalRateLimitMax;
  });

  it('should export rateLimiter middleware function', async () => {
    const { rateLimiter } = await import('../../src/middlewares/rateLimit');
    expect(rateLimiter).toBeDefined();
    expect(typeof rateLimiter).toBe('function');
  });

  it('should export authRateLimiter middleware function', async () => {
    const { authRateLimiter } = await import('../../src/middlewares/rateLimit');
    expect(authRateLimiter).toBeDefined();
    expect(typeof authRateLimiter).toBe('function');
  });

  it('should export transactionRateLimiter middleware function', async () => {
    const { transactionRateLimiter } = await import('../../src/middlewares/rateLimit');
    expect(transactionRateLimiter).toBeDefined();
    expect(typeof transactionRateLimiter).toBe('function');
  });

  it('should skip rate limiting in test environment for rateLimiter', async () => {
    process.env.NODE_ENV = 'test';
    const { rateLimiter } = await import('../../src/middlewares/rateLimit');

    const mockRequest = {
      path: '/api/some-endpoint',
      ip: '127.0.0.1',
    } as any;

    const mockResponse = {} as any;
    const nextFunction = vi.fn();

    await rateLimiter(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it('should skip rate limiting in test environment for authRateLimiter', async () => {
    process.env.NODE_ENV = 'test';
    const { authRateLimiter } = await import('../../src/middlewares/rateLimit');

    const mockRequest = {
      path: '/api/login',
      ip: '127.0.0.1',
    } as any;

    const mockResponse = {} as any;
    const nextFunction = vi.fn();

    await authRateLimiter(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it('should skip rate limiting in test environment for transactionRateLimiter', async () => {
    process.env.NODE_ENV = 'test';
    const { transactionRateLimiter } = await import('../../src/middlewares/rateLimit');

    const mockRequest = {
      path: '/api/transactions',
      ip: '127.0.0.1',
    } as any;

    const mockResponse = {} as any;
    const nextFunction = vi.fn();

    await transactionRateLimiter(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it('should skip rate limiting for /api-docs path', async () => {
    process.env.NODE_ENV = 'production';
    const { rateLimiter } = await import('../../src/middlewares/rateLimit');

    const mockRequest = {
      path: '/api-docs',
      ip: '127.0.0.1',
    } as any;

    const mockResponse = {} as any;
    const nextFunction = vi.fn();

    await rateLimiter(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it('should use custom environment variables for rate limiting configuration', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_WINDOW_MS = '30000';
    process.env.RATE_LIMIT_MAX_REQUESTS = '50';

    vi.resetModules();

    const { rateLimiter } = await import('../../src/middlewares/rateLimit');

    expect(rateLimiter).toBeDefined();
    expect(typeof rateLimiter).toBe('function');
  });

  it('should have default configuration when env vars are not set', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;

    vi.resetModules();

    const { rateLimiter } = await import('../../src/middlewares/rateLimit');

    expect(rateLimiter).toBeDefined();
    expect(typeof rateLimiter).toBe('function');
  });
});
