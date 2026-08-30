import { Injectable, BadRequestException } from '@nestjs/common';
import { ScopedPrismaService } from '../../core/tenancy/scoped-prisma.service';
import { SubstrateService } from '../../core/substrate/substrate.service';
import { EventsService } from '../../core/substrate/events/events.service';
import {
  currentTray,
  isOrdered,
  type Movement,
  type MovementKind,
} from '@nau/gtd';
import {
  orderIntoActions,
  type OrderIntoActions,
} from '@nau/actions/relations/gtd';
import { ACTIONS_ITEM_KIND } from '@nau/actions';
import {
  orderIntoJournal,
  type OrderIntoJournal,
} from '@nau/journal/relations/gtd';
import { JOURNAL_ENTRY_KIND } from '@nau/journal';
import {
  orderIntoReferences,
  type OrderIntoReferences,
} from '@nau/references/relations/gtd';
import { REFERENCES_NOTE_KIND, type NoteProperties } from '@nau/references';

/**
 * The persistence `@nau/gtd`'s core is deliberately without.
 *
 * `Movement` is a log, and naŭ already has one — `core/substrate/events`. A
 * dedicated `Movement` table would be a second event log next to the one that
 * already exists for the exact same shape (one row per thing-that-happened-to-
 * a-block, `type` + `blockId` + `metadata` + `createdAt`), which is the
 * duplication the global rules call out directly. So a movement is stored as
 * an `Event` with `type` prefixed `gtd.` and `metadata: { from, to }` — no
 * schema migration, no new table, and `EventsService` (already tenancy-scoped)
 * is the only thing that touches the database on this class's behalf.
 *
 * `capture`/`process`/`order` never mutate a stored "current tray" field.
 * `currentTray`/`isOrdered` — `@nau/gtd`'s own pure functions — are computed
 * from the event history every time they are asked, which is the same
 * event-sourced discipline the core was designed under, now actually backed
 * by a table.
 */
@Injectable()
export class GtdService {
  constructor(
    private readonly scoped: ScopedPrismaService,
    private readonly substrate: SubstrateService,
    private readonly events: EventsService,
  ) {}

  /** All movements recorded for an item, oldest first — the order `@nau/gtd`'s functions require. */
  private async movementsFor(userId: string, blockId: string): Promise<Movement[]> {
    const rows = await this.events.findByBlock(userId, blockId);

    return rows
      .filter((row) => row.type.startsWith('gtd.'))
      .map((row) => this.toMovement(row))
      .reverse(); // findByBlock orders newest-first; the core wants oldest-first.
  }

  private toMovement(row: {
    type: string;
    metadata: unknown;
    createdAt: Date;
    blockId: string;
  }): Movement {
    const kind = row.type.slice('gtd.'.length) as MovementKind;
    const meta = (row.metadata ?? {}) as { from?: string | null; to?: string | null };
    return {
      itemId: row.blockId,
      kind,
      from: meta.from ?? null,
      to: meta.to ?? null,
      at: row.createdAt.toISOString(),
    };
  }

  private async recordMovement(
    userId: string,
    blockId: string,
    kind: MovementKind,
    from: string | null,
    to: string | null,
  ): Promise<void> {
    await this.events.create(userId, blockId, `gtd.${kind}`, { from, to });
  }

  /**
   * The tray an item sits in right now, or null once ordered.
   *
   * Read-side of the mechanism — what a tray view queries to render its
   * contents, and what every write below re-derives from before deciding
   * whether a transition is valid.
   */
  async currentTray(userId: string, blockId: string): Promise<string | null> {
    const movements = await this.movementsFor(userId, blockId);
    return currentTray(movements, blockId);
  }

  async isOrdered(userId: string, blockId: string): Promise<boolean> {
    const movements = await this.movementsFor(userId, blockId);
    return isOrdered(movements, blockId);
  }

  /**
   * Introduces a new capture to a tray — always `references.note` (nau#111),
   * always the general tray unless a specific one is named.
   *
   * Unlike `process`/`order`, this creates the block: nothing exists before a
   * capture. The block itself is built through `SubstrateService`, which
   * validates it against `@nau/references`' schema exactly as
   * `ReferencesService.createNote` does — this is not a second way to make a
   * note, it is the same substrate call, from GTD's own entry point.
   */
  async capture(params: {
    userId: string;
    workspaceId: string;
    trayId: string;
    content?: string;
    title?: string | null;
  }): Promise<{ blockId: string; trayId: string }> {
    const client = await this.scoped.forUser(params.userId, params.workspaceId);

    const properties: Partial<NoteProperties> = {
      title: params.title ?? null,
      content: params.content ?? '',
    };

    const block = await this.substrate.create<NoteProperties>(client, {
      kind: REFERENCES_NOTE_KIND,
      properties: properties as NoteProperties,
      userId: params.userId,
      source: 'gtd',
    });

    await this.recordMovement(params.userId, block.id, 'capture', null, params.trayId);

    return { blockId: block.id, trayId: params.trayId };
  }

  /**
   * Moves an item from its current tray to a more specific one. The item's
   * kind never changes here — `process` only refines *where* it waits, never
   * *what* it becomes (that is `order`'s job).
   */
  async process(params: {
    userId: string;
    blockId: string;
    toTrayId: string;
  }): Promise<{ blockId: string; trayId: string }> {
    const movements = await this.movementsFor(params.userId, params.blockId);
    const from = currentTray(movements, params.blockId);

    // Checked first, deliberately: an ordered item and a never-captured item
    // both read as `from === null` from currentTray()'s point of view — the
    // two are different facts and need different messages, so the more
    // specific one must be told apart before the generic "no tray" case
    // swallows it.
    if (isOrdered(movements, params.blockId)) {
      throw new BadRequestException(`Block ${params.blockId} has already been ordered`);
    }
    if (from === null) {
      throw new BadRequestException(
        `Block ${params.blockId} has no current tray — it must be captured before it can be processed`,
      );
    }

    await this.recordMovement(params.userId, params.blockId, 'process', from, params.toTrayId);

    return { blockId: params.blockId, trayId: params.toTrayId };
  }

  /**
   * Ends an item's time in a tray by ordering it into one of the three
   * confirmed destinations. `destination` selects which `orderInto*` from
   * `@nau/{actions,journal,references}/relations/gtd` runs — this is the
   * `DestinationHandler` mechanism from `@nau/gtd/relations/zazu/router.ts`
   * wired to real, callable functions, per nau#118.
   *
   * Every destination reads the block's current properties before deciding
   * the new ones (`orderInto*`'s own contract: it never invents from
   * nothing), and writes back through `SubstrateService` — `mutateKind` for
   * Actions/Journal, since ordering into either changes the block's `type`;
   * plain `update` for References, since a note ordered into References
   * never changes kind, per nau#111.
   */
  async order(
    params:
      | { userId: string; workspaceId: string; destination: 'actions'; order: OrderIntoActions }
      | { userId: string; workspaceId: string; destination: 'journal'; order: OrderIntoJournal }
      | {
          userId: string;
          workspaceId: string;
          destination: 'references';
          order: OrderIntoReferences;
        },
  ) {
    const client = await this.scoped.forUser(params.userId, params.workspaceId);
    const blockId = params.order.blockId;

    const movements = await this.movementsFor(params.userId, blockId);
    const from = currentTray(movements, blockId);
    if (from === null) {
      throw new BadRequestException(
        `Block ${blockId} is not in a tray — nothing to order`,
      );
    }

    const current = await this.substrate.findOne<Record<string, unknown>>(client, blockId);

    let result;
    switch (params.destination) {
      case 'actions': {
        const properties = orderIntoActions(params.order, current.properties);
        result = await this.substrate.mutateKind(client, blockId, ACTIONS_ITEM_KIND, properties);
        break;
      }
      case 'journal': {
        const properties = orderIntoJournal(params.order, current.properties);
        result = await this.substrate.mutateKind(client, blockId, JOURNAL_ENTRY_KIND, properties);
        break;
      }
      case 'references': {
        const properties = orderIntoReferences(
          params.order,
          current.properties as NoteProperties,
        );
        result = await this.substrate.update<NoteProperties>(client, blockId, { properties });
        break;
      }
    }

    await this.recordMovement(params.userId, blockId, 'order', from, null);

    return result;
  }
}
