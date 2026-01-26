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
import saleRoutes from './routes/sale.routes';
import productRoutes from './routes/product.routes';

const logger = createServiceLogger('sales-service');
const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());
app.use(requestId);
app.use(requestLogger('sales-service'));
app.use(createHealthRouter('sales-service', isDatabaseHealthy));

app.use('/api/sales', authenticate, requireAccount, saleRoutes);
app.use('/api/products', authenticate, requireAccount, productRoutes);

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
      logger.info({ port: PORT }, 'Sales Service started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start sales service');
    process.exit(1);
  }
}

start();
