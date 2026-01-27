import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RedisOptions = {
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number;
};

type RedisInstance = {
  url: string;
  options: RedisOptions;
  on: ReturnType<typeof vi.fn>;
  emit: (event: string, payload?: unknown) => void;
};

let lastInstance: RedisInstance | null = null;

vi.mock('ioredis', () => {
  class RedisMock {
    public url: string;
    public options: RedisOptions;
    private handlers = new Map<string, (payload?: unknown) => void>();

    constructor(url: string, options: RedisOptions) {
      this.url = url;
      this.options = options;

      const on = vi.fn((event: string, handler: (payload?: unknown) => void) => {
        this.handlers.set(event, handler);
        return this;
      });

      const instance: RedisInstance = {
        url,
        options,
        on,
        emit: (event: string, payload?: unknown) => {
          const handler = this.handlers.get(event);
          handler?.(payload);
        },
      };

      lastInstance = instance;

      // Expose the mocked on function on the class instance too.
      // This mirrors how the real client is used.
      (this as unknown as { on: typeof on }).on = on;

      return instance;
    }
  }

  return { default: RedisMock };
});

describe('redis client (unit)', () => {
  const originalUrl = process.env.REDIS_URL;
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

  beforeEach(() => {
    vi.resetModules();
    lastInstance = null;
    stderrSpy.mockClear();
    stdoutSpy.mockClear();
  });

  afterEach(() => {
    process.env.REDIS_URL = originalUrl;
  });

  it('uses REDIS_URL when provided and configures retry behavior', async () => {
    process.env.REDIS_URL = 'redis://example:6379/1';

    const { default: redis } = await import('../../lib/redis');

    expect(redis).toBeTruthy();
    expect(lastInstance?.url).toBe('redis://example:6379/1');
    expect(lastInstance?.options.maxRetriesPerRequest).toBe(3);
    expect(lastInstance?.options.retryStrategy?.(10)).toBe(500);
    expect(lastInstance?.options.retryStrategy?.(999)).toBe(2000);
  });

  it('falls back to localhost URL and logs connect/error events', async () => {
    delete process.env.REDIS_URL;

    await import('../../lib/redis');

    expect(lastInstance?.url).toBe('redis://localhost:6379');
    expect(lastInstance?.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(lastInstance?.on).toHaveBeenCalledWith('connect', expect.any(Function));

    lastInstance?.emit('connect');
    expect(stdoutSpy).toHaveBeenCalledWith('Redis Client Connected\n');

    lastInstance?.emit('error', new Error('boom'));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Redis Client Error:'));
  });
});
