/**
 * `(GTD)·(Actions)` — re-exports the contract `@nau/actions` published and
 * confirmed at `packages/actions/src/relations/gtd/contract.ts`, per
 * nau#114.
 *
 * GTD's own draft (`OrderIntoActions` with `noteId`) is retired here rather
 * than kept as a second copy. Actions corrected the field to `blockId` —
 * the substrate-level name for a block whose `type` is about to mutate,
 * matching the precedent `(GTD)·(Journal)` already set — and confirmed that
 * no sibling `(Actions)·(Zazŭ)` route exists: everything reaching Actions
 * from capture goes through a tray until nau#5/nau#109 replace the old
 * triage, so this is the only contract Actions needs to publish.
 *
 * This relation depends on `@nau/actions` (its own subpath export,
 * `relations/gtd`) rather than restating its shape — the single source of
 * truth for what ordering into Actions requires is Actions' own package,
 * same as References already is for `references.note`.
 */
export type {
  OrderIntoActions,
  OrderedIntoActions,
  OrderedActionProperties,
} from '@nau/actions/relations/gtd';
export { orderIntoActions } from '@nau/actions/relations/gtd';
