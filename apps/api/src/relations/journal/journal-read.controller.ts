import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JournalReadService } from './journal-read.service';
import type { AccessTokenPayload } from '@nau/types';

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
