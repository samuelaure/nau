import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  async push(
    @CurrentUser() user: AccessTokenPayload,
    @Body()
    body: {
      blocks: Record<string, unknown>[];
    },
  ) {
    // workspaceId/userId are resolved from the authenticated token, never from the
    // client body — a client-supplied workspaceId would let any authenticated user
    // write into a workspace they don't belong to.
    return this.syncService.push(body.blocks, user.sub, user.workspaceId);
  }

  @Get('pull')
  async pull(
    @CurrentUser() user: AccessTokenPayload,
    @Query('lastSyncedAt') lastSyncedAt: string,
  ) {
    return this.syncService.pull(
      lastSyncedAt || new Date(0).toISOString(),
      user.workspaceId,
    );
  }
}
