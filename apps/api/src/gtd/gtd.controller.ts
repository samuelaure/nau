import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { GtdService } from './gtd.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';
import type { OrderIntoActions } from '@nau/actions/relations/gtd';
import type { OrderIntoJournal } from '@nau/journal/relations/gtd';
import type { OrderIntoReferences } from '@nau/references/relations/gtd';
import type { JournalSource, JournalOriginFormat } from '@nau/journal';

class CaptureBody {
  workspaceId?: string;
  trayId!: string;
  content?: string;
  title?: string | null;
}

class ProcessBody {
  toTrayId!: string;
}

/**
 * Ordering a block into one of the three confirmed destinations. `order`
 * always carries `blockId` (nau#111/#114/#115/#117), so the destination-
 * specific fields below are its remainder.
 */
class OrderBody {
  workspaceId?: string;
  destination!: 'actions' | 'journal' | 'references';
  blockId!: string;
  text?: string;
  priority?: 'low' | 'medium' | 'high' | null;
  deadline?: string | null;
  capturedAt?: string;
  source?: JournalSource;
  originFormat?: JournalOriginFormat;
}

/**
 * `(api)·(GTD)` — the persistence and HTTP surface `@nau/gtd`'s core is
 * deliberately without (nau#118). Registers no kind of its own: capture always
 * produces `references.note` (nau#111), and order mutates an existing block
 * into whichever destination confirmed its contract with GTD
 * (nau#114/#115/#117).
 */
@Controller('gtd')
@UseGuards(JwtAuthGuard)
export class GtdController {
  constructor(private readonly gtd: GtdService) {}

  @Post('capture')
  async capture(@CurrentUser() user: AccessTokenPayload, @Body() body: CaptureBody) {
    const ws = body.workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    if (!body.trayId) throw new BadRequestException('trayId is required');

    return this.gtd.capture({
      userId: user.sub,
      workspaceId: ws,
      trayId: body.trayId,
      content: body.content,
      title: body.title,
    });
  }

  @Post(':blockId/process')
  async process(
    @CurrentUser() user: AccessTokenPayload,
    @Param('blockId') blockId: string,
    @Body() body: ProcessBody,
  ) {
    if (!body.toTrayId) throw new BadRequestException('toTrayId is required');

    return this.gtd.process({ userId: user.sub, blockId, toTrayId: body.toTrayId });
  }

  @Post('order')
  async order(@CurrentUser() user: AccessTokenPayload, @Body() body: OrderBody) {
    const ws = body.workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    if (!body.blockId) throw new BadRequestException('blockId is required');

    switch (body.destination) {
      case 'actions': {
        const order: OrderIntoActions = {
          blockId: body.blockId,
          text: body.text,
          priority: body.priority,
          deadline: body.deadline,
        };
        return this.gtd.order({ userId: user.sub, workspaceId: ws, destination: 'actions', order });
      }
      case 'journal': {
        const order: OrderIntoJournal = {
          blockId: body.blockId,
          text: body.text,
          capturedAt: body.capturedAt,
          source: body.source,
          originFormat: body.originFormat,
        };
        return this.gtd.order({ userId: user.sub, workspaceId: ws, destination: 'journal', order });
      }
      case 'references': {
        const order: OrderIntoReferences = { blockId: body.blockId };
        return this.gtd.order({
          userId: user.sub,
          workspaceId: ws,
          destination: 'references',
          order,
        });
      }
      default:
        throw new BadRequestException(
          `Unknown destination "${body.destination}" — expected actions, journal, or references`,
        );
    }
  }

  /**
   * The tray listing nau#125 asked for. Declared before `:blockId/tray`
   * below — NestJS matches routes in declaration order, and a literal
   * segment (`tray`) must be checked before a param segment that would
   * otherwise swallow it as a blockId.
   */
  @Get('tray')
  async listTray(
    @CurrentUser() user: AccessTokenPayload,
    @Query('trayId') trayId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    if (!trayId) throw new BadRequestException('trayId is required');

    const blockIds = await this.gtd.tray(user.sub, ws, trayId);
    return { trayId, blockIds };
  }

  @Get(':blockId/tray')
  async tray(@CurrentUser() user: AccessTokenPayload, @Param('blockId') blockId: string) {
    const trayId = await this.gtd.currentTray(user.sub, blockId);
    const ordered = await this.gtd.isOrdered(user.sub, blockId);
    return { blockId, trayId, ordered };
  }
}
