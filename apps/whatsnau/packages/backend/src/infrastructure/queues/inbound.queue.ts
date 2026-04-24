import { Queue } from 'bullmq';
import { connection } from './connection.js';

export const INBOUND_QUEUE_NAME = 'inbound-webhooks';

/**
 * Queue for processing incoming Webhook events.
 * Decouples the Webhook Controller (fast response) from the Orchestrator (heavy logic/AI).
 */
export const inboundQueue = new Queue(INBOUND_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
