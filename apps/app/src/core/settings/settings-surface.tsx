'use client'

import * as React from 'react'
import { cn } from '@9nau/ui/lib/utils'
import { getSettingsPanels } from '@/core/module-registry/registry'

/**
 * One Settings surface, shared.
 *
 * Core preferences and each module's preferences sit as sibling tabs. The
 * core owns the tab strip and the panel slot; a module supplies only a label
 * and a component, and knows nothing about the tabs beside it. A module that
 * declares no `settingsPanel` simply has no tab.
 */

export interface CoreSettingsTab {
  id: string
  label: string
  component: React.ComponentType
}

export function SettingsSurface({ coreTabs }: { coreTabs: CoreSettingsTab[] }) {
  // Module tabs follow the core's own, which are the ones that exist
  // regardless of what is switched on.
  const moduleTabs = getSettingsPanels({ enabledModuleIds: [] }).map((panel) => ({
    id: panel.moduleId,
    label: panel.label,
    component: panel.component,
  }))

  const tabs = [...coreTabs, ...moduleTabs]
  const [activeId, setActiveId] = React.useState(tabs[0]?.id)

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]
  const ActivePanel = active?.component

  if (!active) return null

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold text-gray-800 dark:text-gray-100">Settings</h1>

      <div role="tablist" aria-label="Settings sections" className="mb-6 flex gap-1 border-b dark:border-gray-800">
        {tabs.map((tab) => {
          const isActive = tab.id === active.id
          return (
            <button
              key={tab.id}
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-gray-900 dark:text-gray-100'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`settings-panel-${active.id}`}
        aria-labelledby={`settings-tab-${active.id}`}
      >
        {ActivePanel && <ActivePanel />}
      </div>
    </div>
  )
}
