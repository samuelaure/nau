'use client'

import * as React from 'react'
import { Trash, Tag, Repeat, Clock, Calendar, MoreVertical } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'

/**
 * The bottom-edge controls a block carries — Recordatorio/Frecuencia/Mover
 * a…/Etiquetas, then a `MoreVertical` menu holding Eliminar. Shared between
 * `BlockEditor`'s open editor and `NoteCard`'s on-hover row so the two never
 * drift apart: a control added to one is a control added to both.
 *
 * `NoteCard` passes `onDelete` and nothing else (no Recordatorio/Frecuencia/
 * Mover a… wiring exists yet — same disabled state as inside the editor).
 * `BlockEditor` additionally renders its own Cerrar button after this,
 * outside this component, since a card that's merely being hovered has
 * nothing to close.
 */
export function BlockToolbar({
  isHabit,
  onDelete,
  canDelete = true,
}: {
  isHabit?: boolean
  onDelete: () => void
  canDelete?: boolean
}) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isMenuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isMenuOpen])

  return (
    <div className="flex flex-1 items-center gap-3">
      <ToolbarButton title="Recordatorio" icon={Clock} disabled />
      <ToolbarButton title="Frecuencia" icon={Repeat} disabled active={isHabit} />
      {/* Disabled — replaces NoteCard's old "A la agenda" (schedule-today),
          dropped when NoteCard's bottom row moved onto this shared
          toolbar. Not yet wired: see nau#152. */}
      <ToolbarButton title="Mover a…" icon={Calendar} disabled />
      <ToolbarButton title="Etiquetas" icon={Tag} disabled />

      <div ref={menuRef} className="relative ml-auto">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsMenuOpen((o) => !o)
          }}
          aria-label="Más opciones"
          className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {isMenuOpen && (
          <div className="absolute bottom-full right-0 mb-1 w-36 rounded-md bg-white py-1 shadow-lg dark:bg-gray-800">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsMenuOpen(false)
                onDelete()
              }}
              disabled={!canDelete}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/40"
            >
              <Trash className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ToolbarButton({
  title,
  icon: Icon,
  onClick,
  disabled,
  active,
}: {
  title: string
  icon: React.ElementType
  onClick?: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      title={disabled ? `${title} — próximamente` : title}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      disabled={disabled}
      className={cn(
        'rounded-full p-2 transition-colors',
        'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700',
        active && 'text-emerald-600 dark:text-emerald-400',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-gray-400',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
