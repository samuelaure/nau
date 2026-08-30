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

/**
 * References owns one thing: the note, and the CRUD every note-taking
 * surface needs (create, edit, list, delete). The substance of the write —
 * validation against `@nau/references`' schema, tree placement, soft-delete —
 * is `SubstrateService`'s job; this class only builds the properties a note
 * takes before handing them to it, following the split Journal already
 * established (nau#92): a relation reaches the substrate through the scope,
 * never through a service outside itself.
 *
 * Ordering — mutating a note's own `type` into a foreign kind (nau#111) — is
 * deliberately absent here. It is the contract `relations/actions/` and
 * `relations/gtd/` publish (per `tmp/references-blueprint.md` §3.1, §3.2),
 * not a References CRUD operation, and lands once those relations exist on
 * the other side.
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
}
