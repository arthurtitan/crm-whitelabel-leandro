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
} from '@gleps/shared';
import authRoutes from './routes/auth.routes';

const logger = createServiceLogger('auth-service');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(requestId);
app.use(requestLogger('auth-service'));

// Health check
app.use(createHealthRouter('auth-service', isDatabaseHealthy));

// Routes
app.use('/api/auth', authRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  await disconnectDatabase();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start() {
  try {
    await connectDatabase();
    await connectRedis();

    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Auth Service started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start auth service');
    process.exit(1);
  }
}

start();
