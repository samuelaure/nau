'use client'

import * as React from 'react'
import { Home } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'

export interface ContentTabDef<TTab extends string> {
  id: TTab
  label: string
}

/**
 * The two-row header that sits above a block's content — Asana-inspired.
 * Row 1: an icon naming the block's kind, then its title. Row 2: whichever
 * tabs the caller passes in — every tray of the same recursive GTD model
 * every block carries.
 *
 * Kept intentionally short (not the tall Asana header with description,
 * assignee, etc.) — "no deben ocupar demasiado espacio, ni ser tampoco
 * excesivamente estrechas."
 *
 * Generic over the tab id: this is a `core/shell` component, and `core/`
 * never names a concrete domain module (boundaries.spec.ts) — so the actual
 * tab list (Bandeja/Acciones/Journal/…) is the caller's concern, not this
 * component's. `home/page.tsx` owns its own `ContentTab` union and `TABS`
 * array; a different page mounting this would define its own.
 */
export function ContentTopBar<TTab extends string>({
  icon,
  title,
  tabs,
  activeTab,
  onTabChange,
  tabControls,
  breadcrumb,
}: {
  icon?: React.ReactNode
  title: string
  tabs: Array<ContentTabDef<TTab>>
  activeTab: TTab
  onTabChange: (tab: TTab) => void
  /** Right-aligned controls specific to the active tab — e.g. Bandeja's group-by selector and grid/list toggle. Rendered on the tab row, at its far end. */
  tabControls?: React.ReactNode
  /** The optional first row, above the title — where a block sits in the tree. Absent at the root (nothing to break out of). */
  breadcrumb?: React.ReactNode
}) {
  return (
    <div className="sticky top-0 z-10 border-b bg-white dark:border-gray-800 dark:bg-gray-950">
      {breadcrumb && <div className="flex h-7 items-center px-6 pt-3">{breadcrumb}</div>}
      {/* Equal padding top and bottom around the title itself — the tabs
          row below has its own py-2 on each button, which is vertical
          padding belonging to the tab row, not the title row, so it must
          not be counted as part of this row's own spacing. */}
      <div className="flex items-center gap-2 px-6 pb-3 pt-3">
        {icon ?? <Home className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-1 px-6">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative px-3 pb-2 text-sm font-medium transition-colors',
                isActive
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {tab.label}
              {isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          )
        })}
        {tabControls && <div className="ml-auto flex items-center gap-2 pb-2">{tabControls}</div>}
      </div>
    </div>
  )
}
