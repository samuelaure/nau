import { Block } from '@9nau/types'
import { cn } from '@9nau/ui/lib/utils'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useDeleteBlock, useUpdateBlock } from '@/hooks/use-blocks-api'
import { useUpsertSchedule } from '@/hooks/use-schedule-api'
import { rangeOf } from '@/components/agenda/scheduling'
import { Button } from '@9nau/ui/components/button'
import { MoreVertical, CalendarPlus } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface NoteCardProps {
  note: Block
}

export function NoteCard({ note }: NoteCardProps) {
  const { setDraggedItem, draggedItem, setEditingNoteId } = useDashboardStore((s) => ({
    setDraggedItem: s.actions.setDraggedItem,
    draggedItem: s.draggedItem,
    setEditingNoteId: s.actions.setEditingNoteId,
  }))
  const deleteBlock = useDeleteBlock()
  const updateBlock = useUpdateBlock()
  const upsertSchedule = useUpsertSchedule()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', note.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem(note)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteBlock.mutate(note.id)
  }

  /**
   * Processes a captured note into something due today.
   *
   * One click and no dialog, because this is the GTD processing step and its
   * whole value is speed: an inbox that takes a form per item stops being
   * emptied. Anything more specific — another day, a frequency, an estimate —
   * is an edit afterwards, on an item that already exists somewhere.
   */
  const handleScheduleToday = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMenuOpen(false)
    const { start, end } = rangeOf({ kind: 'today' })
    await updateBlock.mutateAsync({
      id: note.id,
      updateDto: { type: 'action', properties: { status: 'todo' } },
    })
    await upsertSchedule.mutateAsync({
      blockId: note.id,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rrule: null,
    })
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMenuOpen((prev) => !prev)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'bg-card border rounded-lg shadow-sm cursor-pointer break-inside-avoid group relative flex flex-col',
        draggedItem?.id === note.id ? 'opacity-50' : 'opacity-100'
      )}
    >
      <div onClick={() => setEditingNoteId(note.id)} className="p-4 flex-grow">
        <p className="whitespace-pre-wrap text-sm text-card-foreground break-words max-h-80 overflow-hidden">
          {note.properties.text as string}
        </p>
      </div>
      <div className="h-10 flex items-center justify-end px-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleMenuClick}
            data-testid="note-card-menu-button"
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </Button>
          {isMenuOpen && (
            <div
              ref={menuRef}
              className="absolute bottom-full right-0 mb-1 w-40 bg-white rounded-md shadow-lg border z-10 dark:bg-gray-800"
            >
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sm"
                onClick={handleScheduleToday}
                disabled={updateBlock.isPending || upsertSchedule.isPending}
              >
                <CalendarPlus className="h-4 w-4" />
                A la agenda
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50"
                onClick={handleDelete}
              >
                Delete note
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
