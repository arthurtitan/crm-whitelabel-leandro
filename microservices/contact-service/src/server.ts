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
import contactRoutes from './routes/contact.routes';

const logger = createServiceLogger('contact-service');
const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use(requestId);
app.use(requestLogger('contact-service'));
app.use(createHealthRouter('contact-service', isDatabaseHealthy));

app.use('/api/contacts', authenticate, requireAccount, contactRoutes);

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
      logger.info({ port: PORT }, 'Contact Service started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start contact service');
    process.exit(1);
  }
}

start();
