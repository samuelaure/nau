import type { DestinationHandler } from '@nau/gtd/relations/zazu';

/**
 * The real `DestinationHandler`s `@nau/gtd/relations/zazu/router.ts`'s
 * `activeDestinations`/`isRoutable` expect (nau#118, point 4).
 *
 * All three are `available: () => true` today — none of Actions, Journal or
 * References has a runtime condition under which it stops accepting ordered
 * items. `available` exists in the contract for a case like content-routing's
 * per-brand availability elsewhere in the system; GTD's three confirmed
 * relations simply don't have one yet.
 *
 * What this file does not do, deliberately: call the LLM, or read a
 * transcription from Zazŭ. That hand-off is nau#109's — moving the triage
 * itself into `packages/gtd/src/relations/zazu/`. This is only the registry
 * of destinations that hand-off will route toward, wired against real code
 * rather than left as a contract with nothing behind it.
 */
export const GTD_DESTINATION_HANDLERS: readonly DestinationHandler[] = [
  { destination: 'actions', available: () => true },
  { destination: 'journal', available: () => true },
  { destination: 'references', available: () => true },
];
