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
  subscribe,
  initPubSubListener,
  getPrismaClient,
} from '@gleps/shared';
import eventRoutes from './routes/event.routes';

const logger = createServiceLogger('event-service');
const app = express();
const PORT = process.env.PORT || 3008;
const prisma = getPrismaClient();

app.use(express.json());
app.use(requestId);
app.use(requestLogger('event-service'));
app.use(createHealthRouter('event-service', isDatabaseHealthy));

app.use('/api/events', authenticate, eventRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Subscribe to events channel
async function setupEventListener() {
  initPubSubListener();

  await subscribe('events:create', async (channel, message: any) => {
    try {
      await prisma.event.create({
        data: {
          accountId: message.accountId || null,
          eventType: message.eventType,
          actorType: message.actorType || null,
          actorId: message.actorId || null,
          entityType: message.entityType || null,
          entityId: message.entityId || null,
          channel: message.channel || null,
          payload: message.payload || null,
        },
      });
      logger.debug({ eventType: message.eventType }, 'Event recorded');
    } catch (error) {
      logger.error({ error, message }, 'Failed to record event');
    }
  });

  logger.info('Event listener started');
}

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
    await setupEventListener();

    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Event Service started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start event service');
    process.exit(1);
  }
}

start();
