import { Injectable } from '@nestjs/common';
import { ScopedPrismaService } from '../../core/tenancy/scoped-prisma.service';
import { SubstrateService } from '../../core/substrate/substrate.service';
import {
  buildNewNote,
  applyNoteEdit,
  REFERENCES_NOTE_KIND,
  type Attachment,
  type NoteProperties,
} from '@nau/references';
// `@nau/actions/relations/gtd`, declared only via `package.json`'s `exports`
// field, cannot be resolved under this project's `moduleResolution: "node"`
// (tsconfig.base.json) — the classic resolver ignores `exports` subpaths
// entirely. `dist/relations/gtd/package.json` (built alongside the rest,
// see `@nau/actions`' `build` script) is what makes this path self-
// describing and resolvable without it: a self-contained sub-package,
// exactly how `moduleResolution: "node"` was already finding nested
// packages before `exports` existed. Same latent gap exists in `@nau/journal`'s
// identical `./relations/gtd` export; unexercised until this file, the
// first to import either from an app using this resolver.
import { orderIntoActions, type OrderIntoActions } from '@nau/actions/relations/gtd';
import { ACTIONS_ITEM_KIND } from '@nau/actions';

/**
 * References owns one thing: the note, and the CRUD every note-taking
 * surface needs (create, edit, list, delete). The substance of the write —
 * validation against `@nau/references`' schema, tree placement, soft-delete —
 * is `SubstrateService`'s job; this class only builds the properties a note
 * takes before handing them to it, following the split Journal already
 * established (nau#92): a relation reaches the substrate through the scope,
 * never through a service outside itself.
 *
 * Ordering into Actions — mutating a note's own `type` into `actions.item`
 * (nau#111) — lands here now that `@nau/actions/relations/gtd` exists
 * (nau#114). `orderIntoActions` decides the properties, purely; this method
 * is the persistence-layer act, using `SubstrateService.mutateKind` (also
 * added by nau#114 — the substrate had no operation for changing what a
 * block *is*, only for editing what it holds).
 */
@Injectable()
export class ReferencesService {
  constructor(
    private readonly scoped: ScopedPrismaService,
    private readonly substrate: SubstrateService,
  ) {}

  async createNote(params: {
    userId: string;
    workspaceId: string;
    title?: string | null;
    content?: string;
    attachments?: Attachment[];
    parentId?: string | null;
    source?: string;
    sourceRef?: string;
  }) {
    const properties = buildNewNote({
      title: params.title,
      content: params.content,
      attachments: params.attachments,
    });

    const client = await this.scoped.forUser(params.userId, params.workspaceId);
    return this.substrate.create<NoteProperties>(client, {
      kind: REFERENCES_NOTE_KIND,
      properties,
      parentId: params.parentId ?? null,
      userId: params.userId,
      source: params.source ?? null,
      sourceRef: params.sourceRef ?? null,
    });
  }

  async getNote(userId: string, workspaceId: string, id: string) {
    const client = await this.scoped.forUser(userId, workspaceId);
    return this.substrate.findOne<NoteProperties>(client, id);
  }

  async listNotes(
    userId: string,
    workspaceId: string,
    query: { parentId?: string | null; take?: number; skip?: number } = {},
  ) {
    const client = await this.scoped.forUser(userId, workspaceId);
    return this.substrate.find<NoteProperties>(client, {
      kind: REFERENCES_NOTE_KIND,
      parentId: query.parentId,
      take: query.take,
      skip: query.skip,
    });
  }

  async updateNote(
    userId: string,
    workspaceId: string,
    id: string,
    edit: { title?: string | null; content?: string; attachments?: Attachment[] },
  ) {
    const client = await this.scoped.forUser(userId, workspaceId);
    const current = await this.substrate.findOne<NoteProperties>(client, id);
    const properties = applyNoteEdit({ current: current.properties, ...edit });

    return this.substrate.update<NoteProperties>(client, id, { properties });
  }

  async deleteNote(userId: string, workspaceId: string, id: string) {
    const client = await this.scoped.forUser(userId, workspaceId);
    await this.substrate.remove(client, id);
  }

  /**
   * GTD's `order` act, when the destination is Actions: mutates the note's
   * own `type` to `actions.item` in place (nau#111) — never creates a second
   * block. `orderIntoActions` (pure, `@nau/actions/relations/gtd`) decides
   * the properties from the note's current ones plus whatever GTD's
   * processing corrected; this method reads the note, computes the result,
   * and writes it via `SubstrateService.mutateKind`.
   */
  async orderIntoActions(userId: string, workspaceId: string, order: OrderIntoActions) {
    const client = await this.scoped.forUser(userId, workspaceId);
    const existing = await this.substrate.findOne<Record<string, unknown>>(client, order.blockId);
    const properties = orderIntoActions(order, existing.properties);

    return this.substrate.mutateKind(client, order.blockId, ACTIONS_ITEM_KIND, properties);
  }
}
