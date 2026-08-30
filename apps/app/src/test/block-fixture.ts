import { Block } from '@9nau/types'
import { HierarchicalBlock } from '@9nau/core'

/**
 * A minimal, valid `Block` for specs, with every required field defaulted.
 *
 * Specs were writing block literals by hand and drifting from `Block`'s real
 * shape every time it grew a field (`uuid`, `source`, `sourceRef`,
 * `deletedAt` were added for tenancy/provenance without every fixture
 * following) — a type error that only a real `typecheck` script catches, and
 * one that stayed invisible while that script didn't exist (#3). One factory
 * means the next field `Block` gains needs a default in one place, not in
 * every spec file that builds one.
 */
export function makeBlock(overrides: Partial<Block> & Pick<Block, 'id' | 'type'>): Block {
  const now = new Date().toISOString()
  return {
    uuid: overrides.id,
    parentId: null,
    properties: {},
    source: null,
    sourceRef: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

/** Same as `makeBlock`, with the `children` field `HierarchicalBlock` adds. */
export function makeHierarchicalBlock(
  overrides: Partial<HierarchicalBlock> & Pick<HierarchicalBlock, 'id' | 'type'>,
): HierarchicalBlock {
  return { ...makeBlock(overrides), children: [], ...overrides } as HierarchicalBlock
}
