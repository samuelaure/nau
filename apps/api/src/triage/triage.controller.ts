import { Controller, Post, Get, Query, Body, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { TriageService } from './triage.service';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import type { TriageRequestDto } from '@nau/types';

/**
 * Implements the shared wire contract rather than restating it.
 *
 * The class exists because Nest needs one at runtime for `@Body()`; the shape
 * comes from `@nau/types`, which is what Zazŭ builds its request against. If
 * the two drift, this stops compiling.
 *
 * Every field needs a `class-validator` decorator, not just a TypeScript
 * type: with `whitelist: true`/`forbidNonWhitelisted: true` (global, see
 * `app.module.ts`), a plain-TS-typed field with no decorator emits no
 * design-time metadata, so `class-validator` cannot confirm it belongs to
 * the class — it then rejects every property on the body as unknown, not
 * just the undecorated one. Reproduced against production 2026-08-31: a real
 * journal capture (`sourceBlockId: a3b399ea-...`) was rejected 400 with
 * "property text should not exist" on a body that matched this class
 * exactly, because none of its six fields carried a decorator.
 */
export class TriageDto implements TriageRequestDto {
  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sourceBlockId?: string;

  @IsOptional()
  @IsString()
  brandId?: string | null;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsBoolean()
  journalOnly?: boolean;

  @IsOptional()
  @IsString()
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
