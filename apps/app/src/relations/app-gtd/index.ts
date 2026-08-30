/**
 * DRAFT — no confirmed nav/route yet in `app`.
 *
 * No `ModuleDescriptor` exported: the Inbox view this relation would back
 * cannot be built until `module:gtd` confirms how a tray's contents are
 * listed (see `use-gtd.ts`'s note on `useTrayContents`). Registering a nav
 * entry for a view with no data source would be presence without substance.
 */

export {
  useCapture,
  useProcess,
  useOrder,
  useItemTray,
  useTrayContents,
  type CaptureInput,
  type OrderInput,
  type OrderDestination,
} from './use-gtd'
