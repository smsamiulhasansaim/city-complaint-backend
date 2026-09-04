import Redis from 'ioredis';
import env from './env';

/**
 * Optional Redis client. If REDIS_URL is not set (local dev, or Vercel without
 * Upstash), this stays null and the cache helpers become no-ops — the app runs
 * exactly the same, just without caching. Cached on globalThis for serverless.
 */
const globalForRedis = globalThis as unknown as {
  redis?: Redis | null;
  redisLoggedError?: boolean;
};

let redis: Redis | null = globalForRedis.redis ?? null;

if (redis === null && env.redisUrl) {
  redis = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    // Give up reconnecting after a few tries; cache is best-effort.
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 300, 1500)),
  });

  redis.on('error', (err) => {
    // Log once so a down cache never spams logs or crashes the process.
    if (!globalForRedis.redisLoggedError) {
      globalForRedis.redisLoggedError = true;
      console.warn('[redis] unavailable, running without cache:', err.message);
    }
  });

  globalForRedis.redis = redis;
}

export default redis;
