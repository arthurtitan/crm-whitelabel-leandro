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
import tagRoutes from './routes/tag.routes';
import funnelRoutes from './routes/funnel.routes';

const logger = createServiceLogger('kanban-service');
const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());
app.use(requestId);
app.use(requestLogger('kanban-service'));
app.use(createHealthRouter('kanban-service', isDatabaseHealthy));

app.use('/api/tags', authenticate, requireAccount, tagRoutes);
app.use('/api/funnels', authenticate, requireAccount, funnelRoutes);

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
      logger.info({ port: PORT }, 'Kanban Service started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start kanban service');
    process.exit(1);
  }
}

start();
