'use client'

import * as React from 'react'
import { useCreateBlock } from '@/hooks/use-blocks-api'
import { useUiStore } from '@/lib/state/ui-store'
import { Card } from '@9nau/ui/components/card'
import { Button } from '@9nau/ui/components/button'

export function NoteInput() {
  const [isExpanded, setExpanded] = React.useState(false)
  const [text, setText] = React.useState('')
  const formRef = React.useRef<HTMLFormElement>(null)
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null)

  const createBlock = useCreateBlock()

  React.useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto'
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`
    }
  }, [text])

  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)

  /**
   * Saves, and only then clears.
   *
   * The text is cleared on success rather than on submit: a capture lost to a
   * failed request is not recoverable from anywhere, and this box is the first
   * thing a thought lands in.
   */
  const handleClose = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setExpanded(false)
      return
    }

    const today = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    // The day the person is looking at, in their own clock. A note belongs to
    // the day it was captured, which is not a due date and never becomes one.
    const dateInUserTimeZone = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

    createBlock.mutate(
      {
        type: 'note',
        workspaceId: activeWorkspaceId ?? undefined,
        properties: { text: trimmed, status: 'inbox', date: dateInUserTimeZone },
      },
      {
        onSuccess: () => {
          setText('')
          setExpanded(false)
        },
      },
    )
  }

  // Bound to the latest handler on every render. The previous version listed
  // `formRef.current` as a dependency, which never changes identity, so the
  // listener kept whichever `handleClose` it captured first.
  const closeRef = React.useRef(handleClose)
  closeRef.current = handleClose

  React.useEffect(() => {
    if (!isExpanded) return
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        closeRef.current()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  if (!isExpanded) {
    return (
      <div className="max-w-xl mx-auto mb-8">
        <Card className="p-3 cursor-text text-gray-500" onClick={() => setExpanded(true)}>
          Take a note...
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto mb-8">
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault()
          handleClose()
        }}
        className="bg-card rounded-lg shadow-lg border"
      >
        <div className="p-4">
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Take a note..."
            className="w-full resize-none outline-none text-base bg-transparent"
            style={{ maxHeight: '70vh' }}
            rows={1}
            autoFocus
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            {createBlock.isError && (
              <span className="mr-auto text-xs text-red-600">
                No se pudo guardar. El texto sigue aquí.
              </span>
            )}
            <Button type="button" variant="ghost" onClick={handleClose} disabled={createBlock.isPending}>
              {createBlock.isPending ? 'Guardando…' : 'Listo'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
