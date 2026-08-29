import type { ModuleDescriptor, EnabledWhen, SearchResult } from './contract'

/**
 * The registry's rules, as pure functions over a list of descriptors.
 *
 * Separated from `registry.ts` so the mechanism can be tested without the
 * real module list: a test that imported the live registry would break when
 * a module was renamed or switched off, which would make it a test of the
 * configuration rather than of the rules.
 */

export interface WorkspaceContext {
  /** Modules this workspace has switched on. Empty means none are gated in. */
  enabledModuleIds: string[]
}

function isEnabled(condition: EnabledWhen | undefined, ctx: WorkspaceContext): boolean {
  if (!condition) return true
  return ctx.enabledModuleIds.includes(condition.workspaceHasModule)
}

/**
 * Nav entries, visible ones only, in declared order.
 *
 * `href` is derived from the declared segment rather than stored, so an
 * entry and the route it points at cannot drift apart.
 */
export function selectNavEntries(modules: ModuleDescriptor[], ctx: WorkspaceContext) {
  return modules
    .filter((m) => m.nav && isEnabled(m.nav.enabledWhen, ctx))
    .map((m) => ({ moduleId: m.id, ...m.nav!, href: `/${m.nav!.segment}` }))
    .sort((a, b) => a.order - b.order)
}

export function selectRoutes(modules: ModuleDescriptor[], ctx: WorkspaceContext) {
  return modules.flatMap((m) => m.routes ?? []).filter((r) => isEnabled(r.enabledWhen, ctx))
}

/**
 * One route by its URL segment, or undefined if no module owns it.
 *
 * Goes through `selectRoutes` so a disabled module's route is unreachable by
 * URL and not merely absent from the nav — hiding a link is not access
 * control.
 */
export function selectRouteBySegment(
  modules: ModuleDescriptor[],
  segment: string,
  ctx: WorkspaceContext,
) {
  return selectRoutes(modules, ctx).find((r) => r.segment === segment)
}

export function selectWidgets(
  modules: ModuleDescriptor[],
  slot: string,
  ctx: WorkspaceContext,
) {
  return modules
    .flatMap((m) => m.widgets ?? [])
    .filter((w) => w.slot === slot && isEnabled(w.enabledWhen, ctx))
    .sort((a, b) => a.order - b.order)
}

export function selectSettingsPanels(modules: ModuleDescriptor[], ctx: WorkspaceContext) {
  return modules
    .filter((m) => m.settingsPanel && isEnabled(m.settingsPanel.enabledWhen, ctx))
    .map((m) => ({ moduleId: m.id, ...m.settingsPanel! }))
    .sort((a, b) => a.order - b.order)
}

/**
 * Fans a query out to every module that can search and flattens the results.
 *
 * The core awaits each promise and renders `SearchResult`; it never inspects
 * which module a result came from.
 */
export async function runSearch(
  modules: ModuleDescriptor[],
  query: string,
  _ctx: WorkspaceContext,
): Promise<SearchResult[]> {
  const providers = modules.filter((m) => m.search)
  const results = await Promise.all(providers.map((m) => m.search!.run(query)))
  return results.flat()
}
