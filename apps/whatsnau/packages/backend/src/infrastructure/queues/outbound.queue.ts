import { Queue } from 'bullmq';
import { connection } from './connection.js';

export const OUTBOUND_QUEUE_NAME = 'outbound-messages';

/**
 * Queue for sending messages to WhatsApp.
 * Decouples the application logic from the WhatsApp Provider API/Network calls.
 */
export const outboundQueue = new Queue(OUTBOUND_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100, // Keep last 100 completed
    removeOnFail: 500, // Keep last 500 failed for debugging
  },
});
