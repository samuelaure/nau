import type { ZodType } from 'zod';

/**
 * What a block *is*, declared by the module that owns it.
 *
 * The substrate stores the substance of a block — identity, tenancy, tree,
 * timestamps. It does not know what any block means. Meaning is registered
 * here, by the relation that owns it, at startup.
 *
 * Why a registry and not an enum
 * ------------------------------
 * The obvious way to type a polymorphic table is a central enum listing every
 * type the system knows. That is the mistake this file exists to avoid, and it
 * is the same one the Time module already corrected: a global `PeriodType`
 * holding every system's vocabulary became `{ system, scale }`, so that a scale
 * id alone is meaningless and two systems may both have a "month" without
 * collision (nau#57).
 *
 * A central enum here would mean:
 *
 *   - the core names every concrete implementation, which is precisely what
 *     stops a contract from being a contract;
 *   - adding a kind is a schema migration and a coordinated deploy;
 *   - every module's session contends on one file to extend its own domain.
 *
 * A registry gives each kind an *owner* instead. That is the property an enum
 * cannot provide, and its absence is the measured cause of the vocabulary drift
 * this replaces: `task` and `action`, `capture` and `captured` and
 * `voice_capture`, `synthesis` and `journal_synthesis` all reached production
 * because no single place owned the answer.
 */
export interface BlockKind<TProperties = unknown> {
  /**
   * Namespaced as `<module>.<kind>`, e.g. `<owner>.<noun>`. The owner is part
   * of the identifier, so two modules cannot collide and the owner of any row
   * is readable from the row itself.
   */
  readonly id: string;

  /**
   * The shape of this kind's `properties`, validated at runtime.
   *
   * Runtime rather than a TypeScript type because the boundary is a database
   * column: a TS type is erased at exactly the point where the guarantee is
   * needed. The current code casts through `unknown` on the way in and out,
   * which means nothing is checked on write and nothing is guaranteed on read.
   */
  readonly schema: ZodType<TProperties>;

  /** What this kind can do. Declared, never inferred. See KindCapabilities. */
  readonly capabilities: KindCapabilities;

  /**
   * Fields promoted out of the JSON into real, indexed columns.
   *
   * The JSON remains the single source of truth; a projection is derived and
   * never independently writable, so the two cannot disagree. This is the same
   * discipline `Planning` already applies to its resolved interval: stored only
   * so a query can use an index, rebuildable at any time, never edited on its
   * own.
   */
  readonly projections?: readonly Projection[];
}

/**
 * What a kind supports, declared by the kind rather than assumed by its callers.
 *
 * This is Time's `projects: false` insight generalised. A trigger-driven time
 * system cannot enumerate future periods — not for lack of data but by nature —
 * so rather than forcing it to invent an answer, the contract lets it say so
 * and callers branch on the declaration (nau#57):
 *
 *   when implementations differ in what they can do, that difference belongs in
 *   the contract as a declared flag, not in the caller as a special case.
 *
 * The concrete thing this retires: a hardcoded list, held by one consumer,
 * enumerating which of *other* modules' types belong on an agenda. Under this
 * contract the consumer asks for kinds that declare themselves schedulable, and
 * a new schedulable kind appears without that consumer being edited.
 */
export interface KindCapabilities {
  /** May carry a plan — a placement in some time system. */
  readonly schedulable: boolean;
  /** May be tagged. */
  readonly taggable: boolean;
  /** Participates in incremental sync for offline clients. */
  readonly syncable: boolean;
  /** May have children in the block tree. */
  readonly nestable: boolean;
  /** Is soft-deleted rather than removed outright. */
  readonly softDeletable: boolean;
}

/** The SQL type a projected column takes. */
export type ProjectionType = 'text' | 'timestamptz' | 'boolean' | 'integer' | 'double precision';

/**
 * One field lifted from `properties` into a queryable column.
 *
 * Without this, querying a JSON payload means a cast in raw SQL against an
 * unindexed key — which is exactly how one module came to depend on another
 * module's private storage format in a string the type system cannot see
 * (nau#63). A projection makes the same query typed, indexed, and declared by
 * the kind that owns the field.
 */
export interface Projection {
  /** Key within `properties`. */
  readonly property: string;
  /** Column type to generate. */
  readonly type: ProjectionType;
}

/** A kind id is `<owner>.<name>`; both halves are required. */
export const KIND_ID_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;

/** The owning module's name, read from a kind id. */
export function ownerOf(kindId: string): string {
  return kindId.split('.')[0];
}
