import { outboundWorker } from './outbound.worker.js';
import { inboundWorker } from './inbound.worker.js';
import { logger } from '../../core/logger.js';

export const initWorkers = () => {
  logger.info('Starting Background Workers for Queues...');
  // Workers start processing immediately upon instantiation
  return { outboundWorker, inboundWorker };
};
