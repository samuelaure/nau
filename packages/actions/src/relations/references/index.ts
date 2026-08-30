/**
 * `(Actions)·(References)`, published as `@nau/actions/relations/references`
 * rather than folded into the package's root export.
 *
 * Same reasoning as Actions' other relations: this one is optional. If
 * References never existed, `@nau/actions` itself would not change, and
 * whatever imported this path would simply have nothing to import.
 *
 * DRAFT — see `contract.ts`'s own docstring. Written against
 * `packages/references/src/core/review-intent.ts`'s already-published half,
 * to converge with `module:references` the way `(GTD)·(Actions)` and
 * `(GTD)·(Journal)` already did.
 */
export * from './contract';
