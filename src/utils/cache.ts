import redis from '../config/redis';

/**
 * Cache-aside helpers. All operations are best-effort: if Redis is not
 * configured or is unreachable, gets return null and writes are skipped, so the
 * caller transparently falls back to the database.
 */

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> => {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    /* best-effort */
  }
};

export const cacheDel = async (...keys: string[]): Promise<void> => {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    /* best-effort */
  }
};

export const CacheKeys = {
  categories: 'cache:categories',
  services: 'cache:services',
  adminDashboard: 'cache:dashboard:admin',
} as const;

export const CacheTTL = {
  categories: 3600,
  services: 3600,
  dashboard: 60,
} as const;
