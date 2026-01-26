import { Router, Request, Response } from 'express';
import { isRedisHealthy } from '../redis/client';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  checks: {
    database?: boolean;
    redis?: boolean;
    [key: string]: boolean | undefined;
  };
}

/**
 * Create health check router
 */
export function createHealthRouter(
  serviceName: string,
  checkDatabase?: () => Promise<boolean>
): Router {
  const router = Router();
  const startTime = Date.now();
  const version = process.env.npm_package_version || '1.0.0';

  router.get('/health', async (req: Request, res: Response) => {
    const checks: HealthStatus['checks'] = {};

    // Check Redis
    checks.redis = await isRedisHealthy().catch(() => false);

    // Check Database if checker provided
    if (checkDatabase) {
      checks.database = await checkDatabase().catch(() => false);
    }

    // Determine overall status
    const allChecks = Object.values(checks);
    const allHealthy = allChecks.every(c => c);
    const anyHealthy = allChecks.some(c => c);

    let status: HealthStatus['status'];
    if (allHealthy) {
      status = 'healthy';
    } else if (anyHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      service: serviceName,
      version,
      checks,
    };

    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  router.get('/ready', async (req: Request, res: Response) => {
    // Readiness probe - check if service can accept traffic
    let ready = true;

    if (checkDatabase) {
      ready = await checkDatabase().catch(() => false);
    }

    if (ready) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false });
    }
  });

  router.get('/live', (req: Request, res: Response) => {
    // Liveness probe - check if service is alive
    res.status(200).json({ alive: true });
  });

  return router;
}
