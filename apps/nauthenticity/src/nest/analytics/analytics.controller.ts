import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { AnalyticsService } from './analytics.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'

@Controller()
@UseGuards(AnyAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('queue')
  getQueueStatus() {
    return this.analyticsService.getQueueStatus()
  }

  @Post('queue/retry-failed')
  retryFailed(@Body() body: { queueName?: string }) {
    return this.analyticsService.retryFailed(body.queueName)
  }

  @Post('queue/clear-failed')
  clearFailed(@Body() body: { queueName?: string }) {
    return this.analyticsService.clearFailed(body.queueName)
  }

  @Post('queue/delete-job')
  async deleteJob(@Body() body: { queueName?: string; jobId?: string }) {
    if (!body.queueName || !body.jobId) throw new BadRequestException('Missing parameters')
    const result = await this.analyticsService.deleteJob(body.queueName, body.jobId)
    if (!result) throw new NotFoundException('Job not found')
    return result
  }
}
