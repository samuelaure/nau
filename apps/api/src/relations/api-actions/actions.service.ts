import { Injectable } from '@nestjs/common';
import { ScopedPrismaService } from '../../core/tenancy/scoped-prisma.service';
import { SubstrateService } from '../../core/substrate/substrate.service';
import { ActionItemSchema, ACTIONS_ITEM_KIND, type ActionItemProperties } from '@nau/actions';

/**
 * CRUD over the `actions.item` kind itself — text, priority, deadline,
 * estimate, tree position. Deliberately not "when it's owed": that is
 * `AgendaService`'s question, answered by expanding occurrences against
 * `Planning` (nau#64, not yet migrated off the pre-rebuild service).
 *
 * This is the gap nau#126 names: creating, editing or reading an action,
 * habit, project or routine by itself had no HTTP surface at all — only the
 * agenda's "what's due" view existed. Splitting the two on purpose, the same
 * way `api`'s own comment on nau#76 drew the line: the agenda response can
 * grow to carry enough of a block to render a row without this service
 * changing, and this service can gain fields without the agenda changing.
 *
 * `Shape` (action/habit/project/routine, `@nau/actions`' `shapeOf`) is
 * deliberately not computed here — it needs `Planning`, which is nau#64's
 * territory, not this one's. What this service returns instead is
 * `hasChildren`, the one half of `shapeOf`'s two axes this substrate-only
 * view can answer honestly; a caller that also has the plan (the agenda) can
 * derive the full shape without this service knowing Time exists.
 */
@Injectable()
export class ActionsService {
  constructor(
    private readonly scoped: ScopedPrismaService,
    private readonly substrate: SubstrateService,
  ) {}

  async createItem(params: {
    userId: string;
    workspaceId: string;
    text?: string;
    priority?: 'low' | 'medium' | 'high' | null;
    deadline?: string | null;
    estimateMinutes?: number | null;
    parentId?: string | null;
  }) {
    const properties = ActionItemSchema.parse({
      text: params.text ?? '',
      status: 'todo',
      priority: params.priority ?? null,
      deadline: params.deadline ?? null,
      estimateMinutes: params.estimateMinutes ?? null,
    });

    const client = await this.scoped.forUser(params.userId, params.workspaceId);
    const block = await this.substrate.create<ActionItemProperties>(client, {
      kind: ACTIONS_ITEM_KIND,
      properties,
      parentId: params.parentId ?? null,
      userId: params.userId,
    });

    return this.withHasChildren(block, false);
  }

  async getItem(userId: string, workspaceId: string, id: string) {
    const client = await this.scoped.forUser(userId, workspaceId);
    const block = await this.substrate.findOne<ActionItemProperties>(client, id);
    const children = await this.substrate.children<ActionItemProperties>(client, id);
    return this.withHasChildren(block, children.length > 0);
  }

  /**
   * Every `actions.item` in the workspace, with its tree position — never a
   * single level. A person's actions form a tree of unbounded depth
   * (`tmp/actions-blueprint.md` §2.2: a project's children can themselves be
   * projects), and asking level by level would be one round trip per depth
   * for no reason the client can act on differently. `parentId` on each row
   * is what lets a caller reconstruct the tree, or render it flat and let
   * `hasChildren` decide what expands.
   *
   * `SubstrateService.find` with no `parentId` filter already returns every
   * row of the kind regardless of depth — this method's only addition is
   * computing `hasChildren` per row from the same result set, which is
   * cheaper than a query per node.
   */
  async listItems(
    userId: string,
    workspaceId: string,
    query: { status?: 'todo' | 'done' | 'cancelled' } = {},
  ) {
    const client = await this.scoped.forUser(userId, workspaceId);
    const blocks = await this.substrate.find<ActionItemProperties>(client, {
      kind: ACTIONS_ITEM_KIND,
    });

    const filtered = query.status
      ? blocks.filter((b) => b.properties.status === query.status)
      : blocks;

    const childCounts = new Map<string, number>();
    for (const block of blocks) {
      if (!block.parentId) continue;
      childCounts.set(block.parentId, (childCounts.get(block.parentId) ?? 0) + 1);
    }

    return filtered.map((block) => this.withHasChildren(block, (childCounts.get(block.id) ?? 0) > 0));
  }

  async updateItem(
    userId: string,
    workspaceId: string,
    id: string,
    edit: {
      text?: string;
      status?: 'todo' | 'done' | 'cancelled';
      priority?: 'low' | 'medium' | 'high' | null;
      deadline?: string | null;
      estimateMinutes?: number | null;
      parentId?: string | null;
    },
  ) {
    const client = await this.scoped.forUser(userId, workspaceId);
    const { parentId, ...properties } = edit;

    const block = await this.substrate.update<ActionItemProperties>(client, id, {
      properties,
      ...(parentId !== undefined && { parentId }),
    });

    const children = await this.substrate.children<ActionItemProperties>(client, id);
    return this.withHasChildren(block, children.length > 0);
  }

  async deleteItem(userId: string, workspaceId: string, id: string) {
    const client = await this.scoped.forUser(userId, workspaceId);
    await this.substrate.remove(client, id);
  }

  private withHasChildren<T extends { id: string }>(block: T, hasChildren: boolean) {
    return { ...block, hasChildren };
  }
}
