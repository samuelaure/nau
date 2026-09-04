/**
 * Workspace scoping for every query that touches workspace-owned data.
 *
 * The problem this replaces
 * ------------------------
 * Isolation between workspaces was enforced by each service remembering to call
 * an assertion before querying — in two separate implementations of the same
 * check, across roughly twenty services. That makes tenant isolation an
 * *emergent property of consistent discipline*: a service added later that
 * forgets the call has no failing test and no compile error. It simply serves
 * another workspace's data, and blocks carry personal journal content.
 *
 * The rule here inverts the default. A scoped client cannot express a query
 * that crosses a workspace, because the filter is applied by the client rather
 * than written by the caller. Reaching past it requires calling `unscoped()`,
 * which is greppable, named for what it is, and belongs only in code that has a
 * reason to see across tenants.
 */

/** Models that carry a `workspaceId` and are therefore scoped. */
export const WORKSPACE_OWNED_MODELS = [
  'Block',
  'Tag',
  'Brand',
  'Project',
  'Event',
  'SyncCursor',
  'WorkspaceTimezone',
  'TimeSystemConfig',
  'NamedPeriod',
] as const;

export type WorkspaceOwnedModel = (typeof WORKSPACE_OWNED_MODELS)[number];

export function isWorkspaceOwned(model: string | undefined): model is WorkspaceOwnedModel {
  return model !== undefined && (WORKSPACE_OWNED_MODELS as readonly string[]).includes(model);
}

/**
 * Operations whose `where` clause must be narrowed to the workspace.
 *
 * `create` is absent deliberately: it carries no `where`, and its workspace is
 * set from the scope rather than filtered (see `scopedData`).
 */
export const READ_AND_MUTATE_OPERATIONS = [
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
  'update',
  'delete',
  'upsert',
] as const;

/**
 * `update`/`delete`/`upsert`/`findUnique`(`OrThrow`) require a
 * `WhereUniqueInput` — a unique field (`id`, or a `@@unique` composite)
 * present as a **top-level** key. Nesting the whole `where` under `AND` (as
 * the generic path below does) loses that top-level key, which Prisma 7's
 * client-side validation rejects before the query ever reaches the
 * database — surfaced as a generic `PrismaClientValidationError` /
 * `400 Invalid data provided` for what looks like a normal update on a row
 * that demonstrably exists (nau#145).
 */
const UNIQUE_WHERE_OPERATIONS = [
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
] as const;

/**
 * Narrows a `where` clause to one workspace, preserving whatever it held.
 *
 * Two shapes, because Prisma's two families of operation need different
 * ones: `findMany`/`updateMany`/etc. accept an arbitrary filter tree, so
 * wrapping in `AND` is safe and simplest there. `update`/`delete`/`upsert`/
 * `findUnique` instead require their unique key to survive at the top
 * level — so workspaceId is merged in as a sibling filter alongside it,
 * not nested under `AND`. Both still express "this row's own filter, AND
 * this workspace" — only the shape Prisma requires differs.
 */
export function scopedWhere(
  where: Record<string, unknown> | undefined,
  workspaceId: string,
  operation?: string,
): Record<string, unknown> {
  if (!where || Object.keys(where).length === 0) {
    return { workspaceId };
  }

  if (operation && (UNIQUE_WHERE_OPERATIONS as readonly string[]).includes(operation)) {
    return { ...where, workspaceId };
  }

  return { AND: [where, { workspaceId }] };
}

/**
 * Stamps a create payload with its workspace.
 *
 * Handles the array form of `createMany` as well as a single record, so a bulk
 * insert cannot quietly land rows in no workspace at all.
 */
export function scopedData<T extends Record<string, unknown>>(
  data: T | T[],
  workspaceId: string,
): T | T[] {
  if (Array.isArray(data)) {
    return data.map((row) => ({ ...row, workspaceId }) as T);
  }
  return { ...data, workspaceId };
}
