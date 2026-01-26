import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: process.env.SERVICE_NAME || 'unknown',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const createServiceLogger = (serviceName: string) => {
  return logger.child({ service: serviceName });
};
