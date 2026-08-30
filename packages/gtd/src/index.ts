/**
 * `@nau/gtd` — the flow that connects naŭ's modules.
 *
 *   **GTD is what remains when Actions, References, Journal and Time are all
 *   switched off. It owns the movement, never what is being moved.**
 *
 * Capture, process and order are one verb — moving an item from one
 * container to the next — applied at three levels of specificity, each with
 * its own technical nuance (`core/movement.ts`). Trays are recursive and
 * arbitrary, never a fixed list of phases (`core/tray.ts`): a specific
 * project's own tray is a tray like any other. Engage — context, time
 * available, energy — is the shared selection vocabulary more than one
 * module consumes when choosing what to attend to right now
 * (`core/engage.ts`).
 *
 * There is no tray-item kind of GTD's own. Per nau#111, a capture is
 * `references.note` from the instant it exists; "ordering" it into another
 * module is a mutation of the same block's `type`, never a second record.
 * GTD's core never names that kind, or any other — it operates on item ids
 * whose meaning belongs entirely to whichever module owns them.
 *
 * The layering, enforced by `boundaries.spec.ts`:
 *
 *     relations/  ──▶  core/
 *
 * `core/` is the contract and knows no destination kind, no time system, no
 * LLM, and no consuming module by name. `relations/` hold what is true of
 * GTD's dealings with one other module — the triage that turns a voice
 * capture into pre-typed segments is `(GTD)·(Zazŭ)` and belongs to neither
 * alone.
 */

export * from './core/tray';
export * from './core/movement';
export * from './core/engage';
