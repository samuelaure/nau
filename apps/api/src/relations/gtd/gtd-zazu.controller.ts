import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { GtdTriageService } from './gtd-triage.service';
import { ServiceAuthGuard } from '../../common/guards/service-auth.guard';

export class ZazuTriageDto {
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
  @IsString()
  capturedAt?: string;
}

/**
 * GTD's exclusive entry point for Zazŭ captures.
 * 
 * Invokes the LLM triage engine to classify the incoming text into
 * GTD categories (action, project, reference, etc.).
 */
@UseGuards(ServiceAuthGuard)
@Controller('gtd')
export class GtdZazuController {
  constructor(private readonly triageService: GtdTriageService) {}

  @Post('zazu-triage')
  async processTriage(@Body() body: ZazuTriageDto) {
    const result = await this.triageService.processRawText(
      body.text,
      body.userId || 'default_user',
      body.sourceBlockId,
      body.brandId,
      body.workspaceId,
      body.capturedAt,
    );
    return result;
  }

  @Post('retroprocess')
  async retroprocess(@Body() body: { userId?: string }) {
    const result = await this.triageService.retroprocess(body.userId || 'default_user');
    return result;
  }
}
