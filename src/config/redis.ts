import Redis from 'ioredis';
import env from './env';


const globalForRedis = globalThis as unknown as {
  redis?: Redis | null;
  redisLoggedError?: boolean;
};

let redis: Redis | null = globalForRedis.redis ?? null;

if (redis === null && env.redisUrl) {
  redis = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,

    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 300, 1500)),
  });

  redis.on('error', (err) => {
    if (!globalForRedis.redisLoggedError) {
      globalForRedis.redisLoggedError = true;
      console.warn('[redis] unavailable, running without cache:', err.message);
    }
  });

  globalForRedis.redis = redis;
}

export default redis;
