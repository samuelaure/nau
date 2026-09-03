import { Controller, Post, Get, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { NauthenticityService } from './nauthenticity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Was ServiceAuthGuard, but the only caller is nau-mobile — a per-user client,
// not a service — so it needs JwtAuthGuard like the rest of the user-facing
// surface (naŭ#142).
@Controller('integrations/nauthenticity')
@UseGuards(JwtAuthGuard)
export class NauthenticityController {
  constructor(private readonly nauthenticityService: NauthenticityService) {}

  @Post('targets')
  async addTargets(@Body() body: { brandId: string; usernames: string[] }) {
    return this.nauthenticityService.addTargets(body.brandId, body.usernames);
  }

  @Post('generate-comment')
  async generateComment(@Body() body: { targetUrl: string; brandId: string }) {
    return this.nauthenticityService.generateComment(
      body.targetUrl,
      body.brandId,
    );
  }

  // Bridges nau-mobile's capture flow to nauthenticity's mobile-reprocess
  // pipeline (scrape → download → transcode → R2). The device authenticates
  // here with its own JWT; this forwards to nauthenticity with a signed
  // service token, which is the only credential that pipeline accepts and
  // one the device must never hold. See nau-mobile/docs/reprocessing-pipeline.md.
  @Post('mobile-capture')
  async processMobileCapture(@Body() body: { url?: string }) {
    if (!body.url) throw new BadRequestException('url is required');
    return this.nauthenticityService.processMobileCapture(body.url);
  }

  @Get('mobile-capture/:jobId')
  async getMobileCaptureStatus(@Param('jobId') jobId: string) {
    return this.nauthenticityService.getMobileCaptureStatus(jobId);
  }
}
