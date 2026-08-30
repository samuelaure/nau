/**
 * `(Actions)·(Time)`, published as `@nau/actions/relations/time` rather than
 * folded into the package's root export.
 *
 * Same reasoning as `@nau/actions/relations/gtd`: this relation is optional.
 * If Actions never had an agenda, `@nau/actions` itself would not change,
 * and whatever imported this path would simply have nothing to import.
 *
 * DRAFT — see `contract.ts`'s own docstring. Confirmed and corrected by
 * `module:time`, this file converges the same way `packages/gtd`'s drafts
 * already did for `(GTD)·(Actions)` and `(GTD)·(Journal)`.
 */
export * from './contract';
