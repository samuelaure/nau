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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
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
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
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
