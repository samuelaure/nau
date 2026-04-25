import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common'
import { IngestionService } from './ingestion.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'

@Controller()
@UseGuards(AnyAuthGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  ingest(@Body() body: { username?: string; limit?: number; updateSync?: boolean }) {
    if (!body.username) throw new BadRequestException('Username is required')
    return this.ingestionService.queueIngestion(body.username, body.limit ?? 10, body.updateSync)
  }

  @Post('abort')
  abort(@Body() body: { username?: string }) {
    if (!body.username) throw new BadRequestException('Username is required')
    return this.ingestionService.abort(body.username)
  }

  @Post('pause')
  pause(@Body() body: { username?: string }) {
    if (!body.username) throw new BadRequestException('Username is required')
    return this.ingestionService.pause(body.username)
  }

  @Post('resume')
  resume(@Body() body: { username?: string }) {
    if (!body.username) throw new BadRequestException('Username is required')
    return this.ingestionService.resume(body.username)
  }

  @Get('ingest/status/:jobId')
  getStatus(@Param('jobId') jobId: string) {
    return this.ingestionService.getJobStatus(jobId)
  }
}
