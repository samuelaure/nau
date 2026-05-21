import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { FlownauIntegrationService } from '../integrations/flownau.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flownauService: FlownauIntegrationService,
  ) {}

  async push(
    blocks: Record<string, unknown>[],
    userId?: string,
    workspaceId?: string,
  ) {
    this.logger.log(`Sync PUSH: processing ${blocks.length} blocks`);
    const results = [];

    for (const blockData of blocks) {
      const {
        uuid,
        type,
        properties,
        updatedAt,
        deletedAt,
        source,
        sourceRef,
        workspaceId: blockWorkspaceId,
        userId: blockUserId,
      } = blockData as {
        uuid: string;
        type: string;
        properties: Record<string, unknown>;
        updatedAt: string;
        deletedAt?: string | null;
        source?: string;
        sourceRef?: string;
        workspaceId?: string;
        userId?: string;
      };

      const resolvedWorkspaceId = blockWorkspaceId ?? workspaceId;
      const resolvedUserId = blockUserId ?? userId;

      try {
        const upserted = await this.prisma.block.upsert({
          where: { uuid },
          update: {
            properties: properties as Prisma.InputJsonValue,
            updatedAt: new Date(updatedAt),
            deletedAt: deletedAt ? new Date(deletedAt) : null,
            source,
            sourceRef,
            ...(resolvedWorkspaceId && { workspaceId: resolvedWorkspaceId }),
            ...(resolvedUserId && { userId: resolvedUserId }),
          },
          create: {
            uuid,
            type,
            properties: properties as Prisma.InputJsonValue,
            updatedAt: new Date(updatedAt),
            deletedAt: deletedAt ? new Date(deletedAt) : null,
            source,
            sourceRef,
            workspaceId: resolvedWorkspaceId ?? null,
            userId: resolvedUserId ?? null,
          },
        });
        results.push({ uuid: upserted.uuid, status: 'synced' });

        if (type === 'content_idea') {
          const brandId = (properties as Record<string, unknown>).brandId as string | undefined;
          const text = (properties as Record<string, unknown>).text as string | undefined;
          if (brandId && text) {
            try {
              await this.flownauService.ingestIdeas(brandId, [
                { text, sourceRef: upserted.id },
              ]);
              await this.prisma.block.update({
                where: { id: upserted.id },
                data: {
                  properties: {
                    ...(upserted.properties as Record<string, unknown>),
                    flownauSyncStatus: 'success',
                  } as Prisma.InputJsonValue,
                },
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              this.logger.error(
                `[Flownau-Integration-Error] Failed to forward synced block ${upserted.id}: ${msg}`,
              );
              await this.prisma.block.update({
                where: { id: upserted.id },
                data: {
                  properties: {
                    ...(upserted.properties as Record<string, unknown>),
                    flownauSyncStatus: 'error',
                  } as Prisma.InputJsonValue,
                },
              });
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to upsert block ${uuid}: ${message}`);
        results.push({ uuid, status: 'error', message });
      }
    }

    if (userId && workspaceId) {
      await this.prisma.syncCursor.upsert({
        where: { userId_workspaceId: { userId, workspaceId } },
        update: { lastSyncedAt: new Date() },
        create: { userId, workspaceId, lastSyncedAt: new Date() },
      });
    }

    return results;
  }

  async pull(lastSyncedAt: string, workspaceId?: string) {
    const since = new Date(lastSyncedAt);
    this.logger.log(`Sync PULL: fetching changes since ${since.toISOString()}`);

    const where: Prisma.BlockWhereInput = {
      updatedAt: { gt: since },
      ...(workspaceId ? { workspaceId } : {}),
    };

    const blocks = await this.prisma.block.findMany({
      where,
      include: {
        schedule: true,
        events: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return {
      blocks,
      serverTime: new Date().toISOString(),
    };
  }
}
