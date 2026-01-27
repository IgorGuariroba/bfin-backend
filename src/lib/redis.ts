import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  process.stderr.write(`Redis Client Error: ${String(err)}\n`);
});

redis.on('connect', () => {
  process.stdout.write('Redis Client Connected\n');
});

export default redis;
