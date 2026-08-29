/**
 * The module-registry contract.
 *
 * This is the shape a module declares to become visible in the web app —
 * nav entry, owned routes, embeddable widgets — without `app`'s core ever
 * importing or naming that module. Nothing here is Journal, Actions, or
 * Content; if a field only makes sense for one of them, it does not belong
 * here (see nau#57).
 *
 * Discovery is an explicit import list, not a plugin side-effect: see
 * `registry.ts`. Activating or deactivating a module is adding or removing
 * one line there — visible in one place, decided by the core, never by a
 * module registering itself.
 */

/** A module's own namespace. Never a display string — see `nav.label` for that. */
export type ModuleId = string

/**
 * Every field below is optional except `id`. A module with no page of its
 * own declares no `routes`; a module with no nav presence declares no `nav`.
 * The core iterates whatever is present and asserts nothing about what
 * "every module" has — that assumption is exactly what #57 calls a contract
 * that has stopped being one.
 */
export interface ModuleDescriptor {
  id: ModuleId

  nav?: NavEntry
  routes?: RouteEntry[]
  widgets?: WidgetEntry[]
  search?: SearchProvider
  settingsPanel?: SettingsPanelEntry
}

export interface NavEntry {
  label: string
  icon: LucideIconType
  /**
   * Which of the module's own routes this entry points at, by segment.
   *
   * A segment rather than a free-form href so a nav entry cannot link
   * somewhere its module does not own — the registry can check it against
   * the module's `routes`, which an arbitrary URL string would not allow.
   */
  segment: string
  /** Ascending sort position among visible nav entries. Ties break on id. */
  order: number
  /** Omit to always show. See `EnabledWhen` — no arbitrary function, ever. */
  enabledWhen?: EnabledWhen
}

export interface RouteEntry {
  /** Path segment under the app root, e.g. "journal". No leading/trailing slash. */
  segment: string
  /** The route's root component. Rendering below this point is the module's own concern. */
  component: React.ComponentType
  enabledWhen?: EnabledWhen
}

export interface WidgetEntry {
  /** Which composite surface this widget can be placed on, e.g. "home". */
  slot: string
  component: React.ComponentType
  /** Ascending position within the slot. */
  order: number
  enabledWhen?: EnabledWhen
}

/**
 * Search is a core capability, not a module. The core owns the search UI and
 * the fan-out; each module that has anything searchable declares how to
 * search *its own* domain and how to describe a result — the core never
 * knows what a "journal entry" or an "action" is, only that some provider
 * returned a list of results it can render generically.
 *
 * Unlike `EnabledWhen`, `search` genuinely is a function, not a declared
 * value — searching requires calling the module's own endpoint, which is
 * exactly the kind of domain logic `relations/app-{module}/` exists to hold.
 * The core treats it as opaque: it awaits the promise and renders what comes
 * back, it does not branch on which module supplied it.
 */
export interface SearchProvider {
  run: (query: string) => Promise<SearchResult[]>
}

export interface SearchResult {
  id: string
  title: string
  /** Where selecting this result should navigate to. Owned by the module. */
  href: string
  /** Short line under the title, e.g. a snippet or a date. */
  subtitle?: string
}

/**
 * A module's settings live under one shared Settings surface (tabs), not a
 * page of their own — core-level preferences (theme, sidebar) and each
 * module's preferences sit side by side there. The module supplies only the
 * tab's label and its panel content; the core owns the tab strip and where
 * the panel is mounted.
 */
export interface SettingsPanelEntry {
  label: string
  component: React.ComponentType
  /** Ascending position among visible settings tabs. */
  order: number
  enabledWhen?: EnabledWhen
}

/**
 * A declared condition, not a function. The registry must be able to
 * introspect *why* something is hidden (to render a settings toggle, to test
 * the registry itself) without executing arbitrary module code — a hook or
 * closure here would let a module smuggle logic the core can't reason about,
 * which is the same failure #57 names for capabilities: declared, not assumed.
 *
 * Extend this union as real cases arise. Do not widen it to `() => boolean`.
 */
export type EnabledWhen = { workspaceHasModule: ModuleId }

/**
 * Re-exported so descriptors don't each import lucide-react directly for the
 * type alone. The registry does not care which icon; it cares that every
 * entry can render one.
 */
export type LucideIconType = React.ComponentType<{ className?: string }>
