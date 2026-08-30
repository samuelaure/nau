/**
 * `(References)·(GTD)` — what GTD calls when a tray item is confirmed as
 * References' own, published as `@nau/references/relations/gtd` rather than
 * folded into the package's root export.
 *
 * Kept as a separate entry point deliberately, same as `@nau/actions/relations/gtd`
 * and `@nau/journal/relations/gtd`: this relation is optional. If
 * `packages/gtd` stopped consuming it, `@nau/references` itself would not
 * change, and whatever imported this path would simply have nothing to
 * import — the test nau#57 asks every relation to pass.
 */
export * from './contract';
export * from './order';
