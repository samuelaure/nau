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
  // Check for lead recovery every 15 minutes
  await maintenanceQueue.add(
    'lead-recovery',
    {},
    {
      repeat: {
        pattern: '*/15 * * * *', // Every 15 minutes
      },
    }
  );
};
