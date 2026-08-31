import type { ModuleDescriptor } from './contract'
import {
  selectNavEntries,
  selectRoutes,
  selectRouteBySegment,
  selectWidgets,
  selectSettingsPanels,
  runSearch,
  type WorkspaceContext,
} from './select'

/**
 * The single place that knows which modules exist.
 *
 * Deliberately an explicit import list, not self-registration by side
 * effect: switching a module on or off is one line here, and this file is
 * the only one in `core/` permitted to name a domain module or import from
 * one of its `src/{module}/` folders.
 *
 * The rules themselves live in `select.ts` as pure functions — this file
 * only supplies them with the real list.
 */
// import { journalModule } from '@/journal'
// import { actionsModule } from '@/actions'
// import { gtdModule } from '@/gtd'
// import { referencesModule } from '@/references'
import { timeModule } from '@/time'

const MODULES: ModuleDescriptor[] = [
  // gtdModule,
  // actionsModule,
  // referencesModule,
  // journalModule,
  timeModule,
]

export type { WorkspaceContext }

export const getNavEntries = (ctx: WorkspaceContext) => selectNavEntries(MODULES, ctx)

export const getRoutes = (ctx: WorkspaceContext) => selectRoutes(MODULES, ctx)

export const getRouteBySegment = (segment: string, ctx: WorkspaceContext) =>
  selectRouteBySegment(MODULES, segment, ctx)

export const getWidgets = (slot: string, ctx: WorkspaceContext) =>
  selectWidgets(MODULES, slot, ctx)

export const getSettingsPanels = (ctx: WorkspaceContext) => selectSettingsPanels(MODULES, ctx)

export const searchAllModules = (query: string, ctx: WorkspaceContext) =>
  runSearch(MODULES, query, ctx)
