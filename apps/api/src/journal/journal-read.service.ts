import { Injectable, NotFoundException } from '@nestjs/common';
import { ScopedPrismaService } from '../core/tenancy/scoped-prisma.service';
import {
  JOURNAL_ENTRY_KIND,
  JOURNAL_SYNTHESIS_KIND,
  LEGACY_TYPE_BY_KIND,
  type JournalEntryProperties,
  type JournalSynthesisProperties,
} from '@nau/journal';

/** One entry, as a consumer of Journal sees it. */
export interface JournalEntryView {
  id: string;
  kind: typeof JOURNAL_ENTRY_KIND;
  text: string;
  /** When it was lived, not when ingestion finished. */
  date: string;
  source: string;
  originFormat: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One synthesis, as a consumer of Journal sees it. */
export interface JournalSynthesisView {
  id: string;
  kind: typeof JOURNAL_SYNTHESIS_KIND;
  synthesis: string | null;
  reflection: string | null;
  from: string;
  to: string;
  /** True when the period held nothing to read; no model was called. */
  noData: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Journal's own read path, replacing the shared polymorphic `/blocks` endpoint.
 *
 * Why this exists rather than a generic block query: `/blocks?type=journal_entry`
 * forced every caller to know the whole vocabulary and let none of them be
 * typed. The web app over-fetched and filtered in the browser, splitting on
 * `b.type === 'note' | 'action' | 'journal_entry'` — three modules' concerns in
 * one component, and a payload carrying everyone's data to render one list.
 *
 * The route is the filter here, applied server-side.
 *
 * What is deliberately not exposed: `textOriginal`, `sourceId` and
 * `originFormat`'s underlying capture reference are private to Journal
 * (nau#79). A view is not the stored shape — publishing the whole properties
 * object is how a private field becomes a public one by accident, which is
 * exactly what happened when Time started reading `properties.date` directly.
 */
@Injectable()
export class JournalReadService {
  constructor(private readonly scoped: ScopedPrismaService) {}

  // ── Writes (entry) ─────────────────────────────────────────────────────────

  /**
   * Creates a plain journal entry directly from the App.
   *
   * Unlike the Zazŭ path (which goes through `JournalService.createEntry`), the
   * App has no audio and always sends clean text, so the builder call is
   * avoided — it is validated at the domain boundary, and a blank entry is a
   * valid draft from the user's perspective.
   */
  async createEntry(
    userId: string,
    workspaceId: string,
    params: { text: string; date?: string },
  ): Promise<JournalEntryView> {
    const client = await this.scoped.forUser(userId, workspaceId);
    const now = new Date().toISOString();
    const properties: JournalEntryProperties = {
      text: params.text,
      textOriginal: params.text,
      date: params.date ?? now,
      source: 'app',
      originFormat: 'text',
    };
    const row = await client.block.create({
      data: {
        type: LEGACY_TYPE_BY_KIND[JOURNAL_ENTRY_KIND],
        properties: properties as unknown as object,
        userId,
      },
    });
    return this.toEntryView(row);
  }

  /**
   * Edits the user-facing text of an entry.
   *
   * `textOriginal` is never touched — it is the immutable capture. `editedAt`
   * is stamped so downstream consumers (synthesis generation) know to prefer
   * the corrected text. Editing an entry never regenerates any synthesis that
   * already includes it (nau#36).
   */
  async updateEntry(
    userId: string,
    workspaceId: string,
    id: string,
    params: { text: string },
  ): Promise<JournalEntryView> {
    const client = await this.scoped.forUser(userId, workspaceId);
    const existing = await client.block.findUnique({
      where: { id, type: LEGACY_TYPE_BY_KIND[JOURNAL_ENTRY_KIND], deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Journal entry ${id} not found`);

    const prev = (existing.properties ?? {}) as unknown as JournalEntryProperties;
    const updated: JournalEntryProperties = {
      ...prev,
      text: params.text,
      editedAt: new Date().toISOString(),
    };
    const row = await client.block.update({
      where: { id },
      data: { properties: updated as unknown as object },
    });
    return this.toEntryView(row);
  }

  /**
   * Soft-deletes an entry.
   *
   * Uses the substrate's `deletedAt` convention, the same as every other block.
   * A deleted entry is not recomposed into future syntheses; existing ones
   * already composed it and are not altered.
   */
  async deleteEntry(userId: string, workspaceId: string, id: string): Promise<{ success: true }> {
    const client = await this.scoped.forUser(userId, workspaceId);
    const existing = await client.block.findUnique({
      where: { id, type: LEGACY_TYPE_BY_KIND[JOURNAL_ENTRY_KIND], deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Journal entry ${id} not found`);

    await client.block.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // ── Writes (synthesis) ──────────────────────────────────────────────────────

  /**
   * Edits the user-facing text of a synthesis or its reflection.
   *
   * `synthesisOriginal` and `reflectionOriginal` are never touched — they are
   * the model's first draft and exist for audit. Editing a synthesis never
   * regenerates it (nau#36) and never triggers re-generation of a superior
   * synthesis that already composed this one. There is no `POST` or `DELETE`
   * for syntheses: they are created by the pipeline, never by hand, and they
   * are permanent records of a period.
   */
  async updateSynthesis(
    userId: string,
    workspaceId: string,
    id: string,
    params: { synthesis?: string; reflection?: string },
  ): Promise<JournalSynthesisView> {
    const client = await this.scoped.forUser(userId, workspaceId);
    const existing = await client.block.findUnique({
      where: { id, type: LEGACY_TYPE_BY_KIND[JOURNAL_SYNTHESIS_KIND], deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Journal synthesis ${id} not found`);

    const prev = (existing.properties ?? {}) as unknown as JournalSynthesisProperties;
    const updated: JournalSynthesisProperties = {
      ...prev,
      ...(params.synthesis !== undefined ? { synthesis: params.synthesis } : {}),
      ...(params.reflection !== undefined ? { reflection: params.reflection } : {}),
      editedAt: new Date().toISOString(),
    };
    const row = await client.block.update({
      where: { id },
      data: { properties: updated as unknown as object },
    });
    return this.toSynthesisView(row);
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  /**
   * Entries within a half-open range `[from, to)`, newest first.
   *
   * The range is optional: without it this returns the most recent entries,
   * which is what a capture list wants. With it, a period view.
   */
  async listEntries(
    userId: string,
    workspaceId: string,
    range?: { from?: Date; to?: Date },
    limit = 100,
  ): Promise<JournalEntryView[]> {
    const client = await this.scoped.forUser(userId, workspaceId);

    const rows = await client.block.findMany({
      where: {
        type: LEGACY_TYPE_BY_KIND[JOURNAL_ENTRY_KIND],
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Filtered in memory rather than in SQL, deliberately and temporarily. The
    // date lives inside the JSON, and querying it means the raw cast this
    // architecture is removing (nau#63). Once `date` is a projected generated
    // column this becomes an indexed `where`, which is why the kind already
    // declares the projection. At 106 live entries the cost is nil; the note is
    // here so the reason is not rediscovered.
    const views = rows
      .map((row) => this.toEntryView(row))
      .filter((view) => this.inRange(view.date, range));

    return views;
  }

  /**
   * Syntheses overlapping a range, newest first.
   *
   * Scale is not a parameter: which scales exist is Time's vocabulary, not
   * Journal's, and a synthesis here is identified by the span it covers.
   */
  async listSyntheses(
    userId: string,
    workspaceId: string,
    range?: { from?: Date; to?: Date },
    limit = 100,
  ): Promise<JournalSynthesisView[]> {
    const client = await this.scoped.forUser(userId, workspaceId);

    const rows = await client.block.findMany({
      where: {
        type: LEGACY_TYPE_BY_KIND[JOURNAL_SYNTHESIS_KIND],
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows
      .map((row) => this.toSynthesisView(row))
      .filter((view) => this.inRange(view.from, range));
  }

  private inRange(iso: string, range?: { from?: Date; to?: Date }): boolean {
    if (!range?.from && !range?.to) return true;
    const at = new Date(iso).getTime();
    if (Number.isNaN(at)) return false;
    if (range.from && at < range.from.getTime()) return false;
    // Half-open: [from, to), so an instant exactly at `to` belongs to the next
    // period, not this one.
    if (range.to && at >= range.to.getTime()) return false;
    return true;
  }

  private toEntryView(row: {
    id: string;
    properties: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): JournalEntryView {
    const p = (row.properties ?? {}) as JournalEntryProperties;
    return {
      id: row.id,
      kind: JOURNAL_ENTRY_KIND,
      text: p.text,
      date: p.date,
      source: p.source,
      originFormat: p.originFormat,
      editedAt: p.editedAt ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toSynthesisView(row: {
    id: string;
    properties: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): JournalSynthesisView {
    const p = (row.properties ?? {}) as JournalSynthesisProperties;
    return {
      id: row.id,
      kind: JOURNAL_SYNTHESIS_KIND,
      // Normalised on the way out: rows written before the tightening carry ''
      // where they mean "nothing to say" (nau#79). A consumer should not have to
      // know which convention a row was written under.
      synthesis: p.synthesis === '' ? null : p.synthesis,
      reflection: p.reflection === '' ? null : p.reflection,
      from: p.from,
      to: p.to,
      noData: p.noData === true,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
