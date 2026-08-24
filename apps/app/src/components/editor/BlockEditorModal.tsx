'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Block, UpdateBlockDto } from '@9nau/types'
import { Trash, Tag, Repeat, Clock, Calendar } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'

interface BlockEditorModalProps {
  block: Block | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (id: string, updateDto: UpdateBlockDto) => void
  onDelete: (id: string) => void
}

/**
 * A block, opened.
 *
 * Shaped after Google Keep rather than a form: title, then the body, then the
 * controls tucked along the bottom edge. A form puts its fields between the
 * person and their words; this puts the words first and keeps everything else
 * out of the way until it is wanted.
 *
 * The body is where the free canvas will live — blocks of any type, nested
 * without an imposed structure, which is the other half of how home works.
 */
export function BlockEditorModal({
  block,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: BlockEditorModalProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!block) return
    const props = block.properties as Record<string, unknown>
    setTitle((props.text || props.summary || props.name || '') as string)
    setBody((props.body as string) || '')
  }, [block])

  useEffect(() => {
    if (!bodyRef.current) return
    bodyRef.current.style.height = 'auto'
    bodyRef.current.style.height = `${bodyRef.current.scrollHeight}px`
  }, [body, isOpen])

  if (!isOpen || !block) return null

  /**
   * Saves on the way out.
   *
   * Keep has no save button and neither does this: closing is the confirmation,
   * and an explicit one would only add a step to something that already ended.
   */
  const commit = () => {
    const props = block.properties as Record<string, unknown>
    const nextTitle = title.trim()
    const nextBody = body.trim()

    const changed = nextTitle !== (props.text ?? '') || nextBody !== (props.body ?? '')
    if (changed) {
      onUpdate(block.id, {
        properties: { ...props, text: nextTitle, body: nextBody || undefined },
      })
    }
    onClose()
  }

  const isHabit = Boolean((block as { schedule?: { rrule?: string } }).schedule?.rrule)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onMouseDown={commit}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') commit()
        }}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          autoFocus
          className="w-full bg-transparent px-5 pt-5 text-lg font-medium text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
        />

        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe algo…"
          rows={4}
          className="w-full flex-1 resize-none overflow-y-auto bg-transparent px-5 py-3 text-sm leading-relaxed text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-300"
        />

        {/* Along the bottom edge, out of the way of the words. Icon-only with
            titles, the way Keep does it, so the row stays quiet. */}
        <div className="flex items-center gap-1 border-t px-3 py-2 dark:border-gray-700">
          <ToolbarButton title="Recordatorio" icon={Clock} disabled />
          <ToolbarButton title="Frecuencia" icon={Repeat} disabled active={isHabit} />
          <ToolbarButton title="Mover a…" icon={Calendar} disabled />
          <ToolbarButton title="Etiquetas" icon={Tag} disabled />
          <ToolbarButton
            title="Eliminar"
            icon={Trash}
            onClick={() => {
              onDelete(block.id)
              onClose()
            }}
          />
          <button
            onClick={commit}
            className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cerrar
          </button>
        </div>
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
      onClick={onClick}
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
