/**
 * `(GTD)·(References)` — re-exports the contract `@nau/references` published
 * and confirmed at `packages/references/src/relations/gtd/contract.ts`, per
 * nau#117.
 *
 * GTD's own draft (`OrderIntoReferences` with `noteId`) is retired here
 * rather than kept as a second copy, same convergence `(GTD)·(Actions)`
 * (nau#114) and `(GTD)·(Journal)` (nau#115) already went through. References
 * corrected `noteId` to `blockId` and confirmed the rest of the draft as-is:
 * no kind mutation (`references.note` is already the kind, per nau#111), and
 * References as the default destination — the one that never needs a
 * `suggestedType` to be correct.
 *
 * This relation depends on `@nau/references` (its own subpath export,
 * `relations/gtd`) rather than restating its shape — the single source of
 * truth for what confirming a note as References' own requires is
 * References' own package.
 */
export type {
  OrderIntoReferences,
  OrderedIntoReferences,
  OrderedNoteProperties,
} from '@nau/references/relations/gtd';
export { orderIntoReferences } from '@nau/references/relations/gtd';
