import { getRedisClient } from './client';
import { logger } from '../utils/logger';
import { CACHE_TTL } from '../types';

/**
 * Get cached value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const data = await client.get(key);

    if (!data) return null;

    return JSON.parse(data) as T;
  } catch (error) {
    logger.warn({ error, key }, 'Cache get failed');
    return null;
  }
}

/**
 * Set cached value
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<void> {
  try {
    const client = getRedisClient();
    const data = JSON.stringify(value);

    await client.setex(key, ttl, data);
  } catch (error) {
    logger.warn({ error, key }, 'Cache set failed');
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (error) {
    logger.warn({ error, key }, 'Cache delete failed');
  }
}

/**
 * Delete cached values by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    logger.warn({ error, pattern }, 'Cache pattern delete failed');
  }
}

/**
 * Get or set cache (cache-aside pattern)
 */
export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<T> {
  // Try cache first
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Cache it
  await setCache(key, data, ttl);

  return data;
}

/**
 * Increment counter
 */
export async function incrementCounter(
  key: string,
  ttl: number = CACHE_TTL.DAY
): Promise<number> {
  try {
    const client = getRedisClient();
    const count = await client.incr(key);

    // Set expiration on first increment
    if (count === 1) {
      await client.expire(key, ttl);
    }

    return count;
  } catch (error) {
    logger.warn({ error, key }, 'Counter increment failed');
    return 0;
  }
}

/**
 * Get counter value
 */
export async function getCounter(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return parseInt(value || '0');
  } catch (error) {
    logger.warn({ error, key }, 'Counter get failed');
    return 0;
  }
}
