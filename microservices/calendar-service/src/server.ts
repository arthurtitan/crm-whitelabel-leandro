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
import calendarRoutes from './routes/calendar.routes';

const logger = createServiceLogger('calendar-service');
const app = express();
const PORT = process.env.PORT || 3007;

app.use(express.json());
app.use(requestId);
app.use(requestLogger('calendar-service'));
app.use(createHealthRouter('calendar-service', isDatabaseHealthy));

app.use('/api/calendar', authenticate, requireAccount, calendarRoutes);

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
      logger.info({ port: PORT }, 'Calendar Service started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start calendar service');
    process.exit(1);
  }
}

start();
