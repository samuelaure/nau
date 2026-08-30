/**
 * `(Journal)·(GTD)` — the fast path from a voice capture straight to the
 * diary, published as `@nau/journal/relations/gtd` rather than folded into
 * the package's root export.
 *
 * Kept as a separate entry point deliberately, the same way `@nau/gtd`
 * exports only `core/` from its own root and keeps every relation reachable
 * only by its own path: this relation is optional. If `packages/gtd`
 * stopped consuming it, `@nau/journal` itself would not change, and
 * whatever imported this path would simply have nothing to import.
 */
export * from './contract';
export * from './order';
