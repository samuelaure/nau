import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ReferencesService } from './references.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';
import type { Attachment } from '@nau/references';

export class CreateNoteBody {
  title?: string | null;
  content?: string;
  attachments?: Attachment[];
  parentId?: string | null;
  workspaceId?: string;
}

export class UpdateNoteBody {
  title?: string | null;
  content?: string;
  attachments?: Attachment[];
}

@Controller('references/notes')
@UseGuards(JwtAuthGuard)
export class ReferencesController {
  constructor(private readonly references: ReferencesService) {}

  @Post()
  async create(@CurrentUser() user: AccessTokenPayload, @Body() body: CreateNoteBody) {
    const ws = body.workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');

    return this.references.createNote({
      userId: user.sub,
      workspaceId: ws,
      title: body.title,
      content: body.content,
      attachments: body.attachments,
      parentId: body.parentId,
      source: 'app',
    });
  }

  @Get()
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('workspaceId') workspaceId?: string,
    @Query('parentId') parentId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');

    return this.references.listNotes(user.sub, ws, {
      parentId,
      take: parseTake(take),
      skip: parseSkip(skip),
    });
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    return this.references.getNote(user.sub, ws, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: UpdateNoteBody,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    return this.references.updateNote(user.sub, ws, id, body);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    await this.references.deleteNote(user.sub, ws, id);
    return { success: true };
  }
}

/**
 * Rejects an unparseable page size rather than letting it reach Prisma as
 * `NaN` — same discipline `journal-read.controller.ts`'s `parseLimit`
 * applies to its own `limit` param (nau#113). A bad `take` falling through
 * as `undefined` would return the unbounded default, which reads as a
 * working query rather than a rejected one.
 */
function parseTake(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new BadRequestException('`take` must be an integer between 1 and 500');
  }
  return parsed;
}

/** Same reasoning as `parseTake`, for the offset rather than the page size. */
function parseSkip(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException('`skip` must be a non-negative integer');
  }
  return parsed;
}
