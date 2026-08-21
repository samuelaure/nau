import { Controller, Post, Get, Body, Param, UseGuards, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { MobileReprocessService } from './mobile-reprocess.service';
import { ServiceAuthGuard } from '../auth/service-auth.guard';

// Called by apps/api on behalf of an authenticated mobile user — never called
// directly by the device, so this stays behind the service token like the rest
// of the _service/* surface. See nau-mobile/docs/reprocessing-pipeline.md.
@Controller()
@UseGuards(ServiceAuthGuard)
export class MobileReprocessController {
  constructor(private readonly service: MobileReprocessService) {}

  @Post('_service/mobile/process-capture')
  @HttpCode(HttpStatus.ACCEPTED)
  processCapture(@Body() body: { url?: string }) {
    if (!body.url) throw new BadRequestException('url is required');
    return this.service.enqueue(body.url);
  }

  @Get('_service/mobile/process-capture/:jobId')
  getStatus(@Param('jobId') jobId: string) {
    return this.service.getStatus(jobId);
  }
}
