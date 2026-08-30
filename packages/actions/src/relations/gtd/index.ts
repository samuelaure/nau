/**
 * `(Actions)·(GTD)` — what GTD calls when a tray item is ordered into
 * Actions, published as `@nau/actions/relations/gtd` rather than folded into
 * the package's root export.
 *
 * Kept as a separate entry point deliberately, the same way `@nau/journal`
 * publishes `relations/gtd` as its own path: this relation is optional. If
 * `packages/gtd` stopped consuming it, `@nau/actions` itself would not
 * change, and whatever imported this path would simply have nothing to
 * import — the test #57 asks every relation to pass.
 */
export * from './contract';
export * from './order';
