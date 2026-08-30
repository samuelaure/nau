/**
 * References' domain rules, independent of transport and persistence.
 *
 * What lives here must run wherever a note's rules matter, including a
 * device with no server relationship — that is the test that decides what
 * belongs in this package rather than in
 * `apps/api/src/relations/api-references/`. Nothing here imports NestJS,
 * Prisma, `@nau/time`, or anything else that could not run on-device.
 */
export * from './core/schemas';
export * from './core/capabilities';
export * from './core/note';
export * from './core/review-intent';
export * from './core/organization';
