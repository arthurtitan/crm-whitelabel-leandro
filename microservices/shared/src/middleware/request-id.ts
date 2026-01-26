import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AuthenticatedRequest } from '../types';

/**
 * Add unique request ID to each request
 */
export function requestId(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        service: serviceName,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        requestId: (req as AuthenticatedRequest).requestId,
      };

      if (res.statusCode >= 400) {
        console.error(JSON.stringify(logData));
      } else if (process.env.NODE_ENV !== 'production') {
        console.log(JSON.stringify(logData));
      }
    });

    next();
  };
}
