import Redis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: Redis | null = null;
let subscriberClient: Redis | null = null;

/**
 * Get Redis client (singleton)
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis client error');
    });

    redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
    });
  }

  return redisClient;
}

/**
 * Get subscriber Redis client (for pub/sub)
 */
export function getSubscriberClient(): Redis {
  if (!subscriberClient) {
    subscriberClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error('Redis subscriber failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    subscriberClient.on('connect', () => {
      logger.info('Redis subscriber connected');
    });

    subscriberClient.on('error', (err) => {
      logger.error({ err }, 'Redis subscriber error');
    });
  }

  return subscriberClient;
}

/**
 * Connect Redis client
 */
export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client.status !== 'ready') {
    await client.connect();
  }
}

/**
 * Disconnect Redis clients
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  if (subscriberClient) {
    await subscriberClient.quit();
    subscriberClient = null;
  }
}

/**
 * Health check for Redis
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
