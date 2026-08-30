import { z } from 'zod';

/**
 * Actions' published contract, enforced at runtime.
 *
 * Same reasoning as `@nau/journal`'s and `@nau/references`'s schemas: a
 * TypeScript type is erased at exactly the boundary where the guarantee is
 * needed — the write to a JSON column — so the shape is declared here and
 * checked on every write.
 *
 * `.passthrough()` is deliberate: `sortOrder` is stamped by the substrate for
 * every kind (nau#85), so it appears in stored properties without being any
 * kind's business. Rejecting it here would make a substrate-managed key fail
 * its owner's validation.
 *
 * One kind, `actions.item` — never four. `Shape` (action/habit/project/
 * routine, `core/shape.ts`) is derived from whether the block has children
 * and whether its plan repeats; nothing in this schema names a shape,
 * because storing one would be the exact vocabulary drift nau#68 measured
 * for `Block.type` (`action`/`task` both live, nothing declaring which is
 * canonical) reintroduced one level down, inside a single kind's properties.
 */
export const ActionItemSchema = z
  .object({
    text: z.string().default(''),
    /**
     * `Status` from `core/contract.ts`, restated here rather than imported —
     * this file has no dependency on `core/`, the same separation
     * `core/attention.ts` keeps from persistence. `todo` is the only state a
     * freshly created item can start in; `done`/`cancelled` are outcomes
     * (`core/attention.ts`), never the value written at creation.
     */
    status: z.enum(['todo', 'done', 'cancelled']).default('todo'),
    priority: z.enum(['low', 'medium', 'high']).nullable().default(null),
    /** ISO instant. A soft deadline the person named, distinct from `Planning` — see the note below. */
    deadline: z.string().nullable().default(null),
    estimateMinutes: z.number().nullable().default(null),
  })
  .passthrough();

export type ActionItemProperties = z.infer<typeof ActionItemSchema>;

/** The kind id Actions owns. Namespaced, so the owner is part of the identity. */
export const ACTIONS_ITEM_KIND = 'actions.item';
