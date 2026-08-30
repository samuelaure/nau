/**
 * Organization — collections and tags — standard note-taking, nothing
 * invented. Per `tmp/references-blueprint.md` §2.2, transversal to whether a
 * note is active or archived (`review-intent.ts`): neither type here knows
 * `ReviewIntent` exists, confirmed explicitly during design (2026-08-30) so
 * that a user opening "Archive" sees the same collection tree and manual
 * order as "Active", filtered rather than duplicated.
 */

/**
 * A collection is to References what a folder is to Keep/Notion: optional
 * hierarchical grouping. What actually nests notes under a collection is the
 * block tree every nestable kind already uses (`parentId`, substance of the
 * core, per `apps/api/src/core/substrate/`) — References does not invent a
 * second hierarchy mechanism. This type exists only to name the concept a
 * relation persists as a `references.note` parent, or as its own kind if a
 * collection ever needs properties of its own beyond a name and a parent.
 */
export interface Collection {
  readonly id: string;
  readonly name: string;
}

/**
 * Tags are free-form, over the `Tag`/`BlockTag` infrastructure GTD's own
 * `SelectionDimension` vocabulary already reuses. References does not own a
 * separate tagging table — the mechanism is `api`'s core substrate; only the
 * decision that a note can carry tags is domain (`capabilities.ts`'s
 * `taggable: true`).
 */
