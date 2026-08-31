import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiCreatedResponse, ApiNoContentResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JournalReadService } from './journal-read.service';
import type { AccessTokenPayload } from '@nau/types';

export class CreateEntryDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  workspaceId?: string;
}

export class UpdateEntryDto {
  @IsString()
  @IsOptional()
  text?: string;
}

export class UpdateSynthesisDto {
  @IsString()
  @IsOptional()
  synthesis?: string;

  @IsString()
  @IsOptional()
  reflection?: string;
}

/**
 * Journal's read surface for people.
 *
 * This is the per-module replacement for `/blocks?type=journal_entry`, agreed
 * with the app session on nau#76. One module's content, one route, filtered
 * server-side — rather than a shared endpoint every caller had to narrow, and
 * over-fetching that made the browser do the filtering.
 *
 * Synthesis *generation* stays where it is, on the service-authenticated route:
 * asking for one means choosing a period, and which periods exist is Time's
 * decision, not a person's request against Journal.
 */
@ApiTags('journal')
@Controller('journal')
@UseGuards(JwtAuthGuard)
export class JournalReadController {
  constructor(private readonly read: JournalReadService) {}

  @Post('entries')
  @ApiOperation({ summary: 'Create a journal entry' })
  @ApiCreatedResponse({ description: 'The created entry.' })
  async createEntry(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: CreateEntryDto,
  ) {
    const ws = body.workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    return this.read.createEntry(user.sub, ws, { text: body.text, date: body.date });
  }

  @Patch('entries/:id')
  @ApiOperation({ summary: 'Edit a journal entry text' })
  @ApiOkResponse({ description: 'The updated entry.' })
  async updateEntry(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Query('workspaceId') workspaceId?: string,
    @Body() body: UpdateEntryDto = {},
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    return this.read.updateEntry(user.sub, ws, id, { text: body.text ?? '' });
  }

  @Delete('entries/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a journal entry' })
  @ApiNoContentResponse({ description: 'Entry deleted.' })
  async deleteEntry(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    return this.read.deleteEntry(user.sub, ws, id);
  }

  @Patch('syntheses/:id')
  @ApiOperation({ summary: 'Edit a journal synthesis text (never regenerates)' })
  @ApiOkResponse({ description: 'The updated synthesis.' })
  async updateSynthesis(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Query('workspaceId') workspaceId?: string,
    @Body() body: UpdateSynthesisDto = {},
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    return this.read.updateSynthesis(user.sub, ws, id, body);
  }

  @Get('entries')
  @ApiOperation({
    summary: 'List journal entries',
    description:
      'Newest first. `from`/`to` bound the instant the entry was lived, as a ' +
      'half-open range [from, to), so an entry exactly at `to` belongs to the ' +
      'next period rather than this one.',
  })
  @ApiQuery({ name: 'workspaceId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Entries the caller can see in this workspace.' })
  async entries(
    @CurrentUser() user: AccessTokenPayload,
    @Query('workspaceId') workspaceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');

    return this.read.listEntries(
      user.sub,
      ws,
      { from: parseInstant(from, 'from'), to: parseInstant(to, 'to') },
      parseLimit(limit),
    );
  }

  @Get('syntheses')
  @ApiOperation({
    summary: 'List journal syntheses',
    description:
      'Newest first. Filtered by the start of the period each synthesis ' +
      'covers. There is no `scale` parameter: which scales exist is the Time ' +
      "module's vocabulary, and a synthesis is identified here by its span.",
  })
  @ApiQuery({ name: 'workspaceId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Syntheses the caller can see in this workspace.' })
  async syntheses(
    @CurrentUser() user: AccessTokenPayload,
    @Query('workspaceId') workspaceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');

    return this.read.listSyntheses(
      user.sub,
      ws,
      { from: parseInstant(from, 'from'), to: parseInstant(to, 'to') },
      parseLimit(limit),
    );
  }
}

/**
 * Rejects an unparseable instant rather than silently ignoring it.
 *
 * A bad date that falls through as `undefined` returns *everything*, which
 * reads as a working query returning too much — the kind of failure that gets
 * diagnosed as a UI bug.
 */
function parseInstant(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`\`${field}\` is not a valid ISO 8601 instant`);
  }
  return parsed;
}

function parseLimit(value: string | undefined): number {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new BadRequestException('`limit` must be an integer between 1 and 500');
  }
  return parsed;
}
