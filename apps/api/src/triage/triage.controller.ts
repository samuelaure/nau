import { Controller, Post, Get, Query, Body, UseGuards } from '@nestjs/common';
import { TriageService } from './triage.service';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';

export class TriageDto {
  text!: string;
  userId?: string;
  sourceBlockId?: string;
  brandId?: string | null;
  workspaceId?: string;
  journalOnly?: boolean;
  /** When the capture was recorded. Falls back to now if the caller omits it. */
  capturedAt?: string;
}

/**
 * `rawText` used to be accepted here: the untouched transcription, sent so the
 * journal entry could hold both the raw and the cleaned form of itself.
 *
 * An entry holds one text now. The original transcription stays with the
 * service that produced it — Zazŭ keeps it on its own `Voicenote` row — and
 * `sourceBlockId` is the way back to it. Callers may still send the field;
 * it is ignored rather than rejected, so Zazŭ does not have to deploy in
 * lockstep with this change.
 */

@UseGuards(ServiceAuthGuard)
@Controller('triage')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post()
  async processTriage(@Body() body: TriageDto) {
    const result = await this.triageService.processRawText(
      body.text,
      body.userId || 'default_user',
      body.sourceBlockId,
      body.brandId,
      body.workspaceId,
      body.journalOnly,
      body.capturedAt,
    );
    return result;
  }

  @Get('brands')
  async getUserBrandsForTriage(@Query('userId') userId: string) {
    const brands = await this.triageService.getUserBrands(userId);
    return { brands };
  }

  @Post('retroprocess')
  async retroprocess(@Body() body: { userId?: string }) {
    const result = await this.triageService.retroprocess(body.userId || 'default_user');
    return result;
  }
}
