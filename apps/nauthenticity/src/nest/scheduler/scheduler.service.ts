import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { runProactiveFanout } from '../../modules/proactive/fanout.processor'

@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SchedulerService.name)
  private intervalId: ReturnType<typeof setInterval> | null = null

  onApplicationBootstrap() {
    // Run every 15 minutes — fanout processor internally evaluates delivery windows
    this.intervalId = setInterval(
      () => {
        this.logger.log('Triggering smart fanout cycle...')
        runProactiveFanout().catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          this.logger.error(`Fanout cycle failed: ${msg}`)
        })
      },
      15 * 60 * 1000,
    )
    this.logger.log('Smart fanout scheduler started (every 15 minutes)')
  }

  onApplicationShutdown() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
