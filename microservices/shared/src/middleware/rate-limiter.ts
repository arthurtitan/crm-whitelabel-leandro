import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../redis/client';
import { RateLimitError } from '../utils/errors';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;       // Time window in milliseconds
  maxRequests: number;    // Max requests per window
  keyGenerator?: (req: Request) => string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

const defaultKeyGenerator = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0]
    : req.ip || 'unknown';
  return `ratelimit:${ip}`;
};

/**
 * Redis-based rate limiter
 */
export function rateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
  } = config;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient();
      const key = keyGenerator(req);

      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      // Set rate limit headers
      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + ttl * 1000);

      if (current > maxRequests) {
        logger.warn({ key, current, maxRequests }, 'Rate limit exceeded');
        throw new RateLimitError();
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Muitas requisições. Tente novamente mais tarde.',
          },
        });
        return;
      }

      // If Redis fails, allow request (fail open)
      logger.warn({ error }, 'Rate limiter error, allowing request');
      next();
    }
  };
}

/**
 * Create rate limiter for specific routes
 */
export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
});

export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  keyGenerator: (req) => `ratelimit:auth:${req.ip}`,
});

export const heavyRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
});
