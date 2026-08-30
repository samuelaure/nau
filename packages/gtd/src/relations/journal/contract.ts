/**
 * `(GTD)·(Journal)` — re-exports the contract `@nau/journal` published and
 * confirmed at `packages/journal/src/relations/gtd/contract.ts`, per
 * nau#115.
 *
 * GTD's own first draft (`OrderIntoJournal` with raw `text`/`sourceBlockId`)
 * was scoped wrong — it described `(Journal)·(Zazŭ)`, the fast path where
 * someone picks "Journal" directly in Zazŭ's form and the capture never
 * touches a tray at all (`processJournalOnly`,
 * `apps/api/src/triage/triage.service.ts`). That relation belongs to Zazŭ,
 * not to GTD.
 *
 * What GTD actually needed is `(GTD)·(Journal)`: what to call once a tray
 * item — already a `references.note`, already processed, possibly holding
 * actions or reference material alongside diary content in the same note —
 * gets ordered into the diary. Journal corrected this itself and published
 * the right shape (`blockId`, not raw capture metadata); this file re-uses
 * it rather than keeping a third copy.
 */
export type { OrderIntoJournal, OrderedIntoJournal } from '@nau/journal/relations/gtd';
export { orderIntoJournal } from '@nau/journal/relations/gtd';
