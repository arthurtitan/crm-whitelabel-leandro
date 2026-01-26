import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import {
  SERVICES,
  createServiceLogger,
  connectRedis,
  createHealthRouter,
  requestId,
  requestLogger,
  errorHandler,
  notFoundHandler,
  apiRateLimiter,
  authRateLimiter,
} from '@gleps/shared';

const logger = createServiceLogger('gateway');
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (for rate limiting)
app.set('trust proxy', 1);

// Security & compression
app.use(helmet());
app.use(compression());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Request tracking
app.use(requestId);
app.use(requestLogger('gateway'));

// Health check
app.use(createHealthRouter('gateway'));

// Proxy configuration
const createProxy = (target: string, pathRewrite?: Record<string, string>): Options => ({
  target,
  changeOrigin: true,
  pathRewrite,
  on: {
    proxyReq: (proxyReq, req: any) => {
      // Forward request ID
      if (req.requestId) {
        proxyReq.setHeader('X-Request-ID', req.requestId);
      }
      // Forward auth header
      const authHeader = req.headers.authorization;
      if (authHeader) {
        proxyReq.setHeader('Authorization', authHeader);
      }
    },
    error: (err, req, res: any) => {
      logger.error({ err, path: req.url }, 'Proxy error');
      if (!res.headersSent) {
        res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Serviço temporariamente indisponível',
          },
        });
      }
    },
  },
});

// Service URLs (use Docker service names in production)
const getServiceUrl = (service: typeof SERVICES[keyof typeof SERVICES]): string => {
  const host = process.env.NODE_ENV === 'production' ? service.host : 'localhost';
  return `http://${host}:${service.port}`;
};

// ============================================
// ROUTE PROXIES
// ============================================

// Auth routes (with stricter rate limiting)
app.use('/api/auth',
  authRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.AUTH), {
    '^/api/auth': '/api/auth',
  }))
);

// User routes
app.use('/api/users',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.USER), {
    '^/api/users': '/api/users',
  }))
);

// Account routes
app.use('/api/accounts',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.USER), {
    '^/api/accounts': '/api/accounts',
  }))
);

// Contact routes
app.use('/api/contacts',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.CONTACT), {
    '^/api/contacts': '/api/contacts',
  }))
);

// Product routes
app.use('/api/products',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.SALES), {
    '^/api/products': '/api/products',
  }))
);

// Sales routes
app.use('/api/sales',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.SALES), {
    '^/api/sales': '/api/sales',
  }))
);

// Tag routes
app.use('/api/tags',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.KANBAN), {
    '^/api/tags': '/api/tags',
  }))
);

// Funnel routes
app.use('/api/funnels',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.KANBAN), {
    '^/api/funnels': '/api/funnels',
  }))
);

// Dashboard routes
app.use('/api/dashboard',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.ANALYTICS), {
    '^/api/dashboard': '/api/dashboard',
  }))
);

// Finance routes
app.use('/api/finance',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.ANALYTICS), {
    '^/api/finance': '/api/finance',
  }))
);

// Insights routes
app.use('/api/insights',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.ANALYTICS), {
    '^/api/insights': '/api/insights',
  }))
);

// Calendar routes
app.use('/api/calendar',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.CALENDAR), {
    '^/api/calendar': '/api/calendar',
  }))
);

// Event routes
app.use('/api/events',
  apiRateLimiter,
  createProxyMiddleware(createProxy(getServiceUrl(SERVICES.EVENT), {
    '^/api/events': '/api/events',
  }))
);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Connect to Redis for rate limiting
    await connectRedis();

    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'API Gateway started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start gateway');
    process.exit(1);
  }
}

start();
