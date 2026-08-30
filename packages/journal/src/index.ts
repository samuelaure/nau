/**
 * Journal's domain rules, independent of transport and persistence.
 *
 * What lives here must run wherever Journal's rules matter, including a
 * device with no server relationship — that is the test that decides what
 * belongs in this package rather than in `apps/api/src/relations/api-journal/`
 * (nau#96). Nothing here imports NestJS, Prisma, or anything else that could
 * not run on-device.
 */
export * from './schemas';
export * from './capabilities';
export * from './entry';
