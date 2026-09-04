'use client'

import * as React from 'react'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'

export interface BreadcrumbItem {
  id: string
  label: string
  onClick: () => void
}

/**
 * Where a block sits in the tree — Google Drive style: `/` (rendered as a
 * chevron, the standard `>` separator) between each level, every level
 * clickable to jump back up to it.
 *
 * Collapses once there are more than a handful of levels: Inicio, then a
 * `…` standing in for whatever is hidden between it and the last two
 * levels (the current block and its immediate parent) — clicking `…`
 * opens the hidden levels as a menu instead of uncollapsing inline, so the
 * bar's height never grows with depth.
 *
 * Not yet wired to real data — see nau#150, blocked on nau#149 (the
 * hierarchical navigation layer this is the visual half of). Today's only
 * caller always passes a single "Inicio" crumb.
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const [isHiddenMenuOpen, setIsHiddenMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isHiddenMenuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsHiddenMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isHiddenMenuOpen])

  if (items.length === 0) return null

  // Root, an ellipsis standing in for whatever's hidden, then the last two
  // levels (parent, current) — only once there's actually something to
  // hide behind it.
  const COLLAPSE_THRESHOLD = 4
  const visible =
    items.length <= COLLAPSE_THRESHOLD
      ? items.map((item) => ({ item, hidden: null as BreadcrumbItem[] | null }))
      : [
          { item: items[0]!, hidden: null },
          { item: null, hidden: items.slice(1, -2) },
          { item: items[items.length - 2]!, hidden: null },
          { item: items[items.length - 1]!, hidden: null },
        ]

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
      {visible.map((entry, i) => (
        <React.Fragment key={entry.item?.id ?? 'hidden'}>
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
          {entry.item ? (
            <button
              onClick={entry.item.onClick}
              className={cn(
                'max-w-[10rem] truncate rounded px-1 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200',
                i === visible.length - 1 && 'font-medium text-gray-600 dark:text-gray-300',
              )}
              title={entry.item.label}
            >
              {entry.item.label}
            </button>
          ) : (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setIsHiddenMenuOpen((o) => !o)}
                aria-label="Mostrar niveles ocultos"
                className="rounded p-0.5 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {isHiddenMenuOpen && entry.hidden && (
                <ul className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  {entry.hidden.map((hiddenItem) => (
                    <li key={hiddenItem.id}>
                      <button
                        onClick={() => {
                          setIsHiddenMenuOpen(false)
                          hiddenItem.onClick()
                        }}
                        className="block w-full truncate px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {hiddenItem.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
