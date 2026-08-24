import { Block } from '@nau/types'

/**
 * The cache edits an optimistic mutation makes to a list of blocks.
 *
 * Kept here, apart from the React Query hooks, for one reason: the web app has
 * no runnable test environment (`jest-environment-jsdom` is not installed, so
 * every spec under `apps/app` is skipped), and this is the logic whose failure
 * is invisible — a wrong patch does not throw, it just leaves the screen
 * showing something the server does not have. Pure functions can be tested
 * where the runner works.
 *
 * Each returns a new array; none mutates its input.
 */

/** Places a not-yet-saved block at the end of the list. */
export function insertOptimistic(blocks: Block[], optimistic: Block): Block[] {
  return [...blocks, optimistic]
}

/**
 * Swaps a placeholder for the row the server actually created.
 *
 * Replaces in place rather than appending and filtering, so the block keeps its
 * position in the list and the row does not jump once the response lands.
 */
export function replaceOptimistic(blocks: Block[], tempId: string, created: Block): Block[] {
  return blocks.map((b) => (b.id === tempId ? created : b))
}

/** Drops a row by id — used both for delete and for rolling back a failed create. */
export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id)
}

/**
 * Applies a property/type/parent edit to one block.
 *
 * `properties` merges rather than replaces: a patch carries only the fields
 * being changed, and assigning the object wholesale would silently drop
 * everything the edit did not mention — for a journal entry that means losing
 * `raw`, `date` and `source` on every text correction.
 *
 * `parentId` is checked with `in` rather than by truthiness, because null is a
 * meaningful value: it means "move to root", and a truthiness test would treat
 * it as "not specified" and leave the block where it was.
 */
export function applyBlockEdit(
  blocks: Block[],
  id: string,
  patch: { properties?: Record<string, unknown>; type?: string; parentId?: string | null },
): Block[] {
  return blocks.map((block) => {
    if (block.id !== id) return block

    const next = {
      ...block,
      properties: { ...block.properties, ...patch.properties },
    } as Block

    if (patch.type) next.type = patch.type
    if ('parentId' in patch) next.parentId = patch.parentId ?? null
    return next
  })
}
