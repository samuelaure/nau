'use client'

import * as React from 'react'
import { LayoutGrid, List, Rows3, ChevronDown } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { useShellStore } from '@/core/shell/shell-store'
import { useNotesViewStore, type NotesGroupBy } from '@/components/notes/notes-view-store'

const GROUP_BY_LABELS: Record<NotesGroupBy, string> = {
  none: 'Sin agrupar',
  createdAt: 'Fecha de creación',
  updatedAt: 'Fecha de modificación',
}

/**
 * Bandeja's own topbar controls — group-by selector and the grid/list
 * toggle. Both are display preferences scoped to this one tray, not the
 * shell, so they render inside `ContentTopBar`'s `tabControls` slot rather
 * than living in the global Header (where the grid/list toggle used to be).
 */
export function BandejaControls() {
  const notesViewMode = useShellStore((s) => s.notesViewMode)
  const setNotesViewMode = useShellStore((s) => s.setNotesViewMode)

  return (
    <>
      <GroupBySelector />
      <button
        onClick={() => setNotesViewMode(notesViewMode === 'grid' ? 'list' : 'grid')}
        aria-label={notesViewMode === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}
        className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        {notesViewMode === 'grid' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
      </button>
    </>
  )
}

function GroupBySelector() {
  const groupBy = useNotesViewStore((s) => s.groupBy)
  const setGroupBy = useNotesViewStore((s) => s.setGroupBy)
  const [isOpen, setIsOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  // Hydration (SSR-safe default → persisted value) happens once, centrally,
  // in AppShell's mount effect — not here. See app-shell.tsx.

  React.useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Rows3 className="h-3.5 w-3.5" />
        {GROUP_BY_LABELS[groupBy]}
        <ChevronDown className="h-3 w-3" />
      </button>
      {isOpen && (
        <ul className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {(Object.keys(GROUP_BY_LABELS) as NotesGroupBy[]).map((key) => (
            <li key={key}>
              <button
                onClick={() => {
                  setGroupBy(key)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
                  groupBy === key ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
                )}
              >
                {GROUP_BY_LABELS[key]}
              </button>
            </li>
          ))}
          <li>
            {/* No tag field exists yet on References' notes (nau#144) — shown
                disabled so the gap is visible in the UI, not just the issue. */}
            <button
              disabled
              title="Requiere que References tenga etiquetas — ver nau#144"
              className="flex w-full cursor-not-allowed items-center px-3 py-1.5 text-left text-sm text-gray-300 dark:text-gray-600"
            >
              Etiqueta
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
