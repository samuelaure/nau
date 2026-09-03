'use client'

import * as React from 'react'
import { Home } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'

export type ContentTab =
  | 'overview'
  | 'bandeja'
  | 'acciones'
  | 'journal'
  | 'references'
  | 'ideas'
  // TEMPORARY — the "chatarrería": naŭ has two parallel implementations of
  // "actions", each named after the component it mounts so they're easy to
  // tell apart while consolidating. Removed once one absorbs the other's
  // remaining function and "Acciones" (above) is real. See
  // tmp/flows/IMPLEMENTATION-PLAN.md.
  | 'actionsSection'
  | 'agendaView'

const TABS: Array<{ id: ContentTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'bandeja', label: 'Bandeja' },
  { id: 'acciones', label: 'Acciones' },
  { id: 'journal', label: 'Journal' },
  { id: 'references', label: 'References' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'actionsSection', label: 'ActionsSection' },
  { id: 'agendaView', label: 'AgendaView' },
]

/**
 * The two-row header that sits above a block's content — Asana-inspired.
 * Row 1: an icon naming the block's kind, then its title. Row 2: the tabs
 * (Overview/Bandeja/Acciones/Journal/References/Ideas), each tray of the
 * same recursive GTD model every block carries.
 *
 * Kept intentionally short (not the tall Asana header with description,
 * assignee, etc.) — "no deben ocupar demasiado espacio, ni ser tampoco
 * excesivamente estrechas."
 */
export function ContentTopBar({
  icon,
  title,
  activeTab,
  onTabChange,
  tabControls,
  breadcrumb,
}: {
  icon?: React.ReactNode
  title: string
  activeTab: ContentTab
  onTabChange: (tab: ContentTab) => void
  /** Right-aligned controls specific to the active tab — e.g. Bandeja's group-by selector and grid/list toggle. Rendered on the title row, alongside it. */
  tabControls?: React.ReactNode
  /** The optional first row, above the title — where a block sits in the tree. Absent at the root (nothing to break out of). */
  breadcrumb?: React.ReactNode
}) {
  return (
    <div className="sticky top-0 z-10 border-b bg-white dark:border-gray-800 dark:bg-gray-950">
      {breadcrumb && <div className="flex h-7 items-center px-6">{breadcrumb}</div>}
      <div className="flex h-12 items-center gap-2 px-6">
        {icon ?? <Home className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h1>
        {tabControls && <div className="ml-auto flex items-center gap-2">{tabControls}</div>}
      </div>
      <div className="flex items-center gap-1 px-6">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative px-3 py-2 text-sm font-medium transition-colors',
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
      </div>
    </div>
  )
}
