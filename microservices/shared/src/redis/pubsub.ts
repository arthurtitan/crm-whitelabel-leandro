import { getRedisClient, getSubscriberClient } from './client';
import { logger } from '../utils/logger';

type MessageHandler = (channel: string, message: unknown) => void | Promise<void>;

const handlers = new Map<string, MessageHandler[]>();

/**
 * Publish message to channel
 */
export async function publish<T>(channel: string, message: T): Promise<void> {
  try {
    const client = getRedisClient();
    const data = JSON.stringify(message);
    await client.publish(channel, data);
    logger.debug({ channel }, 'Message published');
  } catch (error) {
    logger.error({ error, channel }, 'Publish failed');
  }
}

/**
 * Subscribe to channel
 */
export async function subscribe(
  channel: string,
  handler: MessageHandler
): Promise<void> {
  try {
    const subscriber = getSubscriberClient();

    // Store handler
    if (!handlers.has(channel)) {
      handlers.set(channel, []);

      // Subscribe to channel
      await subscriber.subscribe(channel);

      logger.info({ channel }, 'Subscribed to channel');
    }

    handlers.get(channel)!.push(handler);
  } catch (error) {
    logger.error({ error, channel }, 'Subscribe failed');
  }
}

/**
 * Unsubscribe from channel
 */
export async function unsubscribe(channel: string): Promise<void> {
  try {
    const subscriber = getSubscriberClient();
    await subscriber.unsubscribe(channel);
    handlers.delete(channel);
    logger.info({ channel }, 'Unsubscribed from channel');
  } catch (error) {
    logger.error({ error, channel }, 'Unsubscribe failed');
  }
}

/**
 * Initialize pub/sub message handling
 */
export function initPubSubListener(): void {
  const subscriber = getSubscriberClient();

  subscriber.on('message', async (channel, message) => {
    const channelHandlers = handlers.get(channel);

    if (!channelHandlers || channelHandlers.length === 0) {
      return;
    }

    try {
      const data = JSON.parse(message);

      for (const handler of channelHandlers) {
        try {
          await handler(channel, data);
        } catch (error) {
          logger.error({ error, channel }, 'Handler error');
        }
      }
    } catch (error) {
      logger.error({ error, channel }, 'Message parse error');
    }
  });
}

/**
 * Publish event to event service
 */
export async function publishEvent(event: {
  eventType: string;
  accountId?: string;
  actorType: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await publish('events:create', {
    ...event,
    timestamp: new Date().toISOString(),
  });
}
