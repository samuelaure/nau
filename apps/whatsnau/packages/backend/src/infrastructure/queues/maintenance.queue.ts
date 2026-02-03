import { Queue } from 'bullmq';
import { connection } from './connection.js';

export const MAINTENANCE_QUEUE_NAME = 'maintenance-tasks';

export const maintenanceQueue = new Queue(MAINTENANCE_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});

/**
 * Initialize repeatable jobs
 */
export const initRepeatableJobs = async () => {
  // Add other maintenance tasks here if needed
  // Lead recovery is now event-driven (scheduled on HANDOVER)
};
