import express from 'express';
import {
  createServiceLogger,
  connectDatabase,
  connectRedis,
  disconnectDatabase,
  disconnectRedis,
  isDatabaseHealthy,
  createHealthRouter,
  requestId,
  requestLogger,
  errorHandler,
  notFoundHandler,
  authenticate,
  requireAccount,
} from '@gleps/shared';
import dashboardRoutes from './routes/dashboard.routes';
import financeRoutes from './routes/finance.routes';
import insightsRoutes from './routes/insights.routes';

const logger = createServiceLogger('analytics-service');
const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());
app.use(requestId);
app.use(requestLogger('analytics-service'));
app.use(createHealthRouter('analytics-service', isDatabaseHealthy));

app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/finance', authenticate, requireAccount, financeRoutes);
app.use('/api/insights', authenticate, requireAccount, insightsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function shutdown() {
  logger.info('Shutting down...');
  await disconnectDatabase();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function start() {
  try {
    await connectDatabase();
    await connectRedis();
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Analytics Service started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start analytics service');
    process.exit(1);
  }
}

start();
