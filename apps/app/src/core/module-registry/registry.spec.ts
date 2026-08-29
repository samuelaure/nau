import type { ModuleDescriptor } from './contract'
import {
  selectNavEntries,
  selectRoutes,
  selectRouteBySegment,
  selectWidgets,
  selectSettingsPanels,
  runSearch,
} from './select'

/**
 * The registry's mechanism, tested against fabricated modules rather than
 * the real ones.
 *
 * Deliberately so: these tests must not start failing because a real module
 * changed its label or was switched off. What is under test is the
 * mechanism's own rules — ordering, filtering by capability, the enabled
 * condition, and that a module supplying nothing is not assumed to supply
 * something.
 */

const Icon = () => null
const Panel = () => null

const alpha: ModuleDescriptor = {
  id: 'alpha',
  nav: { label: 'Alpha', icon: Icon, segment: 'alpha', order: 2 },
  routes: [{ segment: 'alpha', component: Panel }],
  widgets: [{ slot: 'home', component: Panel, order: 2 }],
  settingsPanel: { label: 'Alpha', component: Panel, order: 2 },
}

const beta: ModuleDescriptor = {
  id: 'beta',
  nav: { label: 'Beta', icon: Icon, segment: 'beta', order: 1 },
  routes: [{ segment: 'beta', component: Panel }],
  widgets: [{ slot: 'home', component: Panel, order: 1 }],
  settingsPanel: { label: 'Beta', component: Panel, order: 1 },
}

/** A module with no face at all — the case the core must not assume away. */
const silent: ModuleDescriptor = { id: 'silent' }

const gated: ModuleDescriptor = {
  id: 'gated',
  nav: {
    label: 'Gated',
    icon: Icon,
    segment: 'gated',
    order: 3,
    enabledWhen: { workspaceHasModule: 'gated' },
  },
  routes: [
    { segment: 'gated', component: Panel, enabledWhen: { workspaceHasModule: 'gated' } },
  ],
}

const all = [alpha, beta, silent, gated]
const noModules = { enabledModuleIds: [] }
const withGated = { enabledModuleIds: ['gated'] }

describe('nav entries', () => {
  it('returns them in declared order, not registration order', () => {
    expect(selectNavEntries(all, noModules).map((e) => e.label)).toEqual(['Beta', 'Alpha'])
  })

  it('derives href from the declared segment', () => {
    expect(selectNavEntries(all, noModules).map((e) => e.href)).toEqual(['/beta', '/alpha'])
  })

  it('carries the owning module id', () => {
    expect(selectNavEntries(all, noModules).map((e) => e.moduleId)).toEqual(['beta', 'alpha'])
  })

  it('omits a module that declares no nav', () => {
    expect(selectNavEntries(all, noModules).map((e) => e.moduleId)).not.toContain('silent')
  })

  it('hides an entry whose condition is unmet, and shows it when met', () => {
    expect(selectNavEntries(all, noModules).map((e) => e.moduleId)).not.toContain('gated')
    expect(selectNavEntries(all, withGated).map((e) => e.moduleId)).toContain('gated')
  })
})

describe('routes', () => {
  it('excludes routes whose condition is unmet', () => {
    expect(selectRoutes(all, noModules).map((r) => r.segment)).toEqual(['alpha', 'beta'])
    expect(selectRoutes(all, withGated).map((r) => r.segment)).toContain('gated')
  })

  it('finds one by segment', () => {
    expect(selectRouteBySegment(all, 'alpha', noModules)?.segment).toBe('alpha')
  })

  it('does not find a route no module owns', () => {
    expect(selectRouteBySegment(all, 'nonexistent', noModules)).toBeUndefined()
  })

  // The gate must hold on the route itself, not only on the nav entry that
  // points at it — otherwise a disabled module stays reachable by typing its
  // URL, which is the kind of hole a nav-only check leaves behind.
  it('does not find a disabled route by segment', () => {
    expect(selectRouteBySegment(all, 'gated', noModules)).toBeUndefined()
    expect(selectRouteBySegment(all, 'gated', withGated)?.segment).toBe('gated')
  })
})

describe('widgets', () => {
  it('returns only the requested slot, in order', () => {
    const widgets = selectWidgets(all, 'home', noModules)
    expect(widgets).toHaveLength(2)
    expect(widgets.map((w) => w.order)).toEqual([1, 2])
  })

  it('returns nothing for a slot no module fills', () => {
    expect(selectWidgets(all, 'nowhere', noModules)).toEqual([])
  })
})

describe('settings panels', () => {
  it('returns them in declared order', () => {
    expect(selectSettingsPanels(all, noModules).map((p) => p.label)).toEqual(['Beta', 'Alpha'])
  })

  it('omits a module that declares none', () => {
    expect(selectSettingsPanels(all, noModules).map((p) => p.moduleId)).not.toContain('silent')
  })
})

describe('search fan-out', () => {
  it('flattens results from every provider', async () => {
    const modules: ModuleDescriptor[] = [
      {
        id: 'one',
        search: { run: async () => [{ id: '1', title: 'One', href: '/one/1' }] },
      },
      {
        id: 'two',
        search: { run: async () => [{ id: '2', title: 'Two', href: '/two/2' }] },
      },
    ]
    const results = await runSearch(modules, 'q', noModules)
    expect(results.map((r) => r.id).sort()).toEqual(['1', '2'])
  })

  it('returns nothing when no module can search', async () => {
    expect(await runSearch([silent], 'q', noModules)).toEqual([])
  })

  it('passes the query through to each provider', async () => {
    const run = jest.fn().mockResolvedValue([])
    await runSearch([{ id: 'x', search: { run } }], 'needle', noModules)
    expect(run).toHaveBeenCalledWith('needle')
  })
})
