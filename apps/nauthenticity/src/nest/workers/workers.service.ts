import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ingestionWorker } from '../../queues/ingestion.worker'
import { downloadWorker } from '../../queues/download.worker'
import { computeWorker } from '../../queues/compute.worker'
import { optimizationWorker } from '../../queues/optimization.worker'

@Injectable()
export class WorkersService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkersService.name)
  private readonly workers = [ingestionWorker, downloadWorker, computeWorker, optimizationWorker]

  async onApplicationBootstrap() {
    this.logger.log('Starting BullMQ workers...')
    await Promise.all(this.workers.map((w) => w.waitUntilReady()))
    this.logger.log('All BullMQ workers ready')
  }

  async onApplicationShutdown() {
    this.logger.log('Closing BullMQ workers...')
    await Promise.all(this.workers.map((w) => w.close()))
    this.logger.log('All BullMQ workers closed')
  }
}
