import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The vocabulary of the activity log. Kept as a closed set so that anything
 * reading a day's activity can rely on what it will find; a free-form string
 * would drift into synonyms and the readers would have to know all of them.
 */
export type BlockEventType =
  | 'block.created'
  | 'block.updated'
  | 'block.status_changed'
  | 'block.completed'
  | 'block.reopened'
  | 'block.scheduled'
  | 'block.deleted'
  | 'block.tagged'
  | 'block.untagged'
  // A single occurrence of a recurring schedule. A habit has no one completion
  // date, so completion belongs to the occurrence and not to the block — which
  // is why these carry `occurrenceAt` in metadata and `block.completed` does not.
  | 'occurrence.completed'
  | 'occurrence.reopened';

const DONE_STATUSES = new Set(['done', 'completed']);

/**
 * Records what happened to a block, and when.
 *
 * A block's properties describe its current state and nothing else: an action
 * that reads `status: 'done'` gives no hint of when it was finished, and
 * `Block.updatedAt` is replaced by the next edit of any kind. Without this log
 * "what did I finish today" cannot be answered from the data at all — which is
 * the gap that makes a day's activity unreconstructable.
 *
 * Writing an event must never be the reason a mutation fails. The log is
 * valuable, the user's data is essential, so every write here is best-effort and
 * a failure is logged rather than propagated.
 */
@Injectable()
export class BlockEventsService {
  private readonly logger = new Logger(BlockEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    type: BlockEventType,
    block: { id: string; workspaceId?: string | null; userId?: string | null },
    metadata: Prisma.InputJsonObject = {},
    actorUserId?: string | null,
  ): Promise<void> {
    try {
      await this.prisma.event.create({
        data: {
          type,
          blockId: block.id,
          workspaceId: block.workspaceId ?? null,
          // Who did it, which is not always who owns the block.
          userId: actorUserId ?? block.userId ?? null,
          metadata,
        },
      });
    } catch (err) {
      this.logger.warn(`Could not record ${type} for block ${block.id}: ${String(err)}`);
    }
  }

  /**
   * Events implied by an update, derived by comparing before and after.
   *
   * A status change is the one transition worth naming on its own — it is what
   * "completed today" and "reopened today" are made of — so it is emitted as its
   * own event rather than left for a reader to infer from a properties diff.
   */
  async recordUpdate(
    before: { id: string; workspaceId?: string | null; userId?: string | null; properties: Prisma.JsonValue },
    after: { properties: Prisma.JsonValue },
    actorUserId?: string | null,
  ): Promise<void> {
    const from = (before.properties as Prisma.JsonObject)?.status as string | undefined;
    const to = (after.properties as Prisma.JsonObject)?.status as string | undefined;

    if (from === to) {
      await this.record('block.updated', before, {}, actorUserId);
      return;
    }

    await this.record('block.status_changed', before, { from: from ?? null, to: to ?? null }, actorUserId);

    const wasDone = from ? DONE_STATUSES.has(from) : false;
    const isDone = to ? DONE_STATUSES.has(to) : false;

    if (isDone && !wasDone) {
      await this.record('block.completed', before, { from: from ?? null }, actorUserId);
    } else if (wasDone && !isDone) {
      await this.record('block.reopened', before, { to: to ?? null }, actorUserId);
    }
  }
}
