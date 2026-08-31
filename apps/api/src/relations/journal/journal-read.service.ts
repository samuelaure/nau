import { Injectable } from '@nestjs/common';
import { ScopedPrismaService } from '../../core/tenancy/scoped-prisma.service';
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
