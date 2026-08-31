import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { JournalService } from './journal.service';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

export class ZazuCaptureDto {
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
  workspaceId?: string;

  @IsOptional()
  @IsString()
  capturedAt?: string;

  @IsOptional()
  @IsString()
  originFormat?: 'voice' | 'text';
}

/**
 * Journal's exclusive entry point for Zazŭ's fast-path captures.
 * 
 * This receives pre-cleaned text directly from Zazŭ when the user
 * explicitly selects Journal. It bypasses GTD's triage entirely.
 */
@UseGuards(ServiceAuthGuard)
@Controller('journal')
export class JournalZazuController {
  constructor(
    private readonly journalService: JournalService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('zazu-capture')
  async processZazuCapture(@Body() body: ZazuCaptureDto) {
    let resolvedWorkspaceId = body.workspaceId;
    let ownerId = body.userId;

    // Fallback: resolve workspace and real user ID if Zazŭ only sent a telegram ID
    if (!resolvedWorkspaceId || (ownerId && !ownerId.includes('-'))) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { id: body.userId },
            { telegramId: body.userId },
          ],
        },
        include: { workspaces: { take: 1 } },
      });
      if (!resolvedWorkspaceId) {
        resolvedWorkspaceId = user?.workspaces?.[0]?.workspaceId;
      }
      ownerId = user?.id;
    }

    if (!resolvedWorkspaceId) {
      throw new BadRequestException(
        'Cannot file a journal entry: no workspace could be resolved for this user',
      );
    }

    const journalBlock = await this.journalService.createEntry({
      text: body.text,
      date: body.capturedAt,
      source: 'zazu',
      originFormat: body.originFormat ?? 'voice',
      workspaceId: resolvedWorkspaceId,
      userId: ownerId,
      sourceId: body.sourceBlockId,
    });

    return {
      success: true,
      summary: 'Entrada de diario guardada.',
      blocks: [journalBlock],
      rawResult: { segments: [], journalEntry: body.text },
    };
  }
}
