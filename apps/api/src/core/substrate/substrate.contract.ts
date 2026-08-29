/**
 * The substance of a block: what is true of any user-owned thing, in any
 * module, including modules not yet written.
 *
 * This is the answer to a question raised while both `api` and `app` were being
 * rebuilt (nau#57): does a shared block table belong in `api`'s core, or is it a
 * convenience several modules opt into?
 *
 * Neither, as it turned out. What is called a "block" is two things sharing one
 * name:
 *
 *   - its **substance** — identity, tenancy, position in a tree, timestamps,
 *     provenance. True of anything a user owns, regardless of what it means.
 *     That is this file, and it belongs in the core.
 *   - its **content** — what it means, which fields it has, which rules hold.
 *     That belongs to the module that owns it, registered as a kind.
 *
 * The test that keeps them apart: every field below must remain meaningful when
 * every module is switched off. A field that only makes sense for one module's
 * content has crossed the line and belongs in that module's kind schema.
 */

/** A block's substance, with its content left opaque. */
export interface BlockSubstance {
  readonly id: string;
  /** Stable across sync and export; distinct from the primary key by design. */
  readonly uuid: string;

  /** The kind id, e.g. `<owner>.<name>`. Meaning lives in the registry. */
  readonly kind: string;

  readonly workspaceId: string;
  readonly userId: string | null;

  /** Position in the tree. Null for a root. */
  readonly parentId: string | null;

  /**
   * Where this came from, when it did not originate here — a client, an import,
   * another service. Kept in the substance because provenance is a property of
   * the row, not of what the row means.
   */
  readonly source: string | null;
  readonly sourceRef: string | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Set rather than removed, for kinds that declare `softDeletable`. */
  readonly deletedAt: Date | null;
}

/**
 * A block as a relation sees it: substance, plus content typed by that
 * relation's own kind schema.
 *
 * Generic over the properties so that a relation gets its own type back rather
 * than a shared `Block` that every module has to narrow. Nothing outside a
 * relation needs to name the content type at all.
 */
export interface Block<TProperties = unknown> extends BlockSubstance {
  readonly properties: TProperties;
}

/** What a relation supplies to create a block. */
export interface CreateBlockInput<TProperties = unknown> {
  readonly kind: string;
  readonly properties: TProperties;
  readonly parentId?: string | null;
  readonly userId?: string | null;
  readonly source?: string | null;
  readonly sourceRef?: string | null;
}

/** What a relation supplies to update one. Substance is not editable here. */
export interface UpdateBlockInput<TProperties = unknown> {
  readonly properties?: Partial<TProperties>;
  readonly parentId?: string | null;
}

/**
 * How a relation asks for its own content.
 *
 * There is no `kinds: string[]` spanning modules by design. A relation queries
 * the kinds it owns; asking across owners is the polymorphic endpoint this
 * architecture removed, and it forced every caller to know the whole
 * vocabulary while letting none of them be typed.
 */
export interface FindBlocksQuery {
  readonly kind: string;
  readonly parentId?: string | null;
  /** Include soft-deleted rows. Defaults to false. */
  readonly includeDeleted?: boolean;
  readonly take?: number;
  readonly skip?: number;
}
