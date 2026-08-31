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
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { ActionsService } from './actions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

export class CreateActionItemBody {
  @IsString()
  @IsOptional()
  text?: string;

  @IsIn(['low', 'medium', 'high'])
  @IsOptional()
  priority?: 'low' | 'medium' | 'high' | null;

  @IsString()
  @IsOptional()
  deadline?: string | null;

  @IsNumber()
  @IsOptional()
  estimateMinutes?: number | null;

  @IsString()
  @IsOptional()
  parentId?: string | null;

  @IsString()
  @IsOptional()
  workspaceId?: string;
}

export class UpdateActionItemBody {
  @IsString()
  @IsOptional()
  text?: string;

  @IsIn(['todo', 'done', 'cancelled'])
  @IsOptional()
  status?: 'todo' | 'done' | 'cancelled';

  @IsIn(['low', 'medium', 'high'])
  @IsOptional()
  priority?: 'low' | 'medium' | 'high' | null;

  @IsString()
  @IsOptional()
  deadline?: string | null;

  @IsNumber()
  @IsOptional()
  estimateMinutes?: number | null;

  @IsString()
  @IsOptional()
  parentId?: string | null;
}

/**
 * `GET /actions/items` returns the tree in one response — the shape `api`
 * proposed on nau#76 (`GET /v1/actions/actions`) as a form, without a `v1`
 * prefix ever landing on any other relation: `agenda.controller.ts`,
 * `references.controller.ts` and `journal.controller.ts` all register
 * unprefixed (`agenda`, `references/notes`, `journal`), and no global prefix
 * is set in `main.ts`. Following the pattern actually shipped rather than
 * the speculative one, per the same discipline the draft-contract method
 * (nau#119) already applies: build against what exists, not what was floated.
 *
 * Named `items`, not `actions`, to read naturally alongside `agenda` and
 * `references/notes` — `/actions/actions` doubles the module name for no
 * reason a URL benefits from.
 */
@Controller('actions/items')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actions: ActionsService) {}

  @Post()
  async create(@CurrentUser() user: AccessTokenPayload, @Body() body: CreateActionItemBody) {
    const ws = body.workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');

    return this.actions.createItem({
      userId: user.sub,
      workspaceId: ws,
      text: body.text,
      priority: body.priority,
      deadline: body.deadline,
      estimateMinutes: body.estimateMinutes,
      parentId: body.parentId,
    });
  }

  @Get()
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('workspaceId') workspaceId?: string,
    @Query('status') status?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');

    if (status !== undefined && !['todo', 'done', 'cancelled'].includes(status)) {
      throw new BadRequestException('`status` must be one of todo, done, cancelled');
    }

    return this.actions.listItems(user.sub, ws, {
      status: status as 'todo' | 'done' | 'cancelled' | undefined,
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
    return this.actions.getItem(user.sub, ws, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: UpdateActionItemBody,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    return this.actions.updateItem(user.sub, ws, id, body);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    await this.actions.deleteItem(user.sub, ws, id);
    return { success: true };
  }
}
