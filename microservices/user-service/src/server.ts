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
} from '@gleps/shared';
import userRoutes from './routes/user.routes';
import accountRoutes from './routes/account.routes';

const logger = createServiceLogger('user-service');
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(requestId);
app.use(requestLogger('user-service'));

app.use(createHealthRouter('user-service', isDatabaseHealthy));

// Protected routes
app.use('/api/users', authenticate, userRoutes);
app.use('/api/accounts', authenticate, accountRoutes);

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
      logger.info({ port: PORT }, 'User Service started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start user service');
    process.exit(1);
  }
}

start();
