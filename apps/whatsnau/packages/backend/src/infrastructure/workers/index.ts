import { outboundWorker } from './outbound.worker.js';
import { inboundWorker } from './inbound.worker.js';
import { maintenanceWorker } from './maintenance.worker.js';
import { initRepeatableJobs } from '../queues/maintenance.queue.js';
import { logger } from '../../core/logger.js';

export const initWorkers = () => {
  logger.info('Starting Background Workers for Queues...');
  // Initialize repeatable jobs (crons)
  initRepeatableJobs().catch((err) => logger.error({ err }, 'Failed to init repeatable jobs'));

  // Workers start processing immediately upon instantiation
  return { outboundWorker, inboundWorker, maintenanceWorker };
};
