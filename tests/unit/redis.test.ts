import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('redis', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalRedisUrl) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
  });

  it('should export redis client with default URL when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;
    const redis = await import('../../src/lib/redis');
    expect(redis.default).toBeDefined();
  });

  it('should export redis client with custom URL when REDIS_URL is set', async () => {
    process.env.REDIS_URL = 'redis://custom-host:6379';
    const redis = await import('../../src/lib/redis');
    expect(redis.default).toBeDefined();
  });

  it('should have redis client with event listeners', async () => {
    const redis = await import('../../src/lib/redis');
    const client = redis.default;

    expect(client).toBeDefined();
    expect(client.on).toBeDefined();
    expect(typeof client.on).toBe('function');
  });
});
