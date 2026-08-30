/**
 * `(Journal)·(Time)` — DRAFT, not yet confirmed by `module:time`.
 *
 * Per nau#119's method: this is already running in production
 * (`apps/api/src/relations/api-journal/journal.service.ts`'s `entriesIn`/
 * `synthesesStartingIn`, consumed by
 * `apps/api/src/time/synthesis-scheduler.service.ts` via
 * `packages/time/src/core/journal-relation.ts`'s `JournalComposition`) — but
 * the shape Time actually reads (`JournalSourceRow`) has never had a home in
 * `@nau/journal` itself. It lives today as a plain interface inside
 * `apps/api`, framework-adjacent by location even though nothing about it
 * needs Nest or Prisma. This draft is that shape, moved here and marked, not
 * invented — every field below is transcribed from what `entriesIn`/
 * `synthesesStartingIn` already return.
 *
 * What this is NOT proposing: no behaviour changes. `apps/api`'s
 * `JournalSourceRow` and the methods that build it stay exactly as they
 * are; this only asks whether the *type* should be re-exported from here so
 * `packages/time` (a package with no dependency on `apps/api`) can name it
 * without duplicating it — the same drift nau#63 already found once between
 * these two modules, this time in a type rather than in a raw SQL string.
 */

/** One thing Time can read as a synthesis source, with Journal's private shape erased. */
export interface JournalSourceRow {
  readonly id: string;
  /** When it was lived (entry) or the period it covers (synthesis). */
  readonly at: Date;
  /** Character count, for estimating token cost without reading full text. */
  readonly textLength: number;
}

/**
 * What Time sends to ask Journal to generate a synthesis.
 *
 * Transcribed from `GenerateSynthesisDto` in `@nau/types`
 * (`packages/types/src/index.ts`) — kept there today as the wire DTO for
 * `POST /journal/synthesis`, with `sourceKind` inlined as a literal rather
 * than importing this package, so the dependency stayed one-way before this
 * package existed to depend on. Whether `@nau/types` should now re-export
 * this instead of keeping its own copy is exactly the kind of question this
 * draft exists to raise, not to answer unilaterally.
 */
export interface GenerateSynthesis {
  readonly workspaceId: string;
  /** The period this belongs to. A label Time assigns, never a query Journal runs. */
  readonly from: string;
  readonly to: string;
  readonly sourceKind: 'entries' | 'syntheses';
  /** Resolved by Time. Journal reads exactly these ids and nothing else. */
  readonly sourceIds: readonly string[];
}
