import { useState } from 'react'
import { Block } from '@9nau/types'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { EditableItem } from './EditableItem'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useUpdateBlock } from '@/hooks/use-blocks-api'
import { useCreateActionItem, useUpdateActionItem, useDeleteActionItem } from '@/actions/use-action-items'
import { useCreateJournalEntry, useUpdateJournalEntry, useDeleteJournalEntry } from '@/journal/use-journal-api'
import { findItemAndParent, HierarchicalBlock } from '@9nau/core'

interface HierarchicalSectionProps {
  dateStr: string
  /**
   * The block type this section writes.
   *
   * `journal_entry` and not `experience`: they were two names for one concept
   * and the normalisation kept the one that is actually written — by Zazŭ, by
   * the web capture, by the voice pipeline. Creating `experience` here produced
   * rows of a type nothing else in the system reads.
   */
  sectionType: 'journal_entry' | 'action'
  title: string
  items: HierarchicalBlock[]
  /**
   * The workspace this section writes into.
   *
   * Sent explicitly rather than left to the server's default. Without it the
   * block lands in whichever workspace the API picks first, which is how
   * entries ended up split between two workspaces without anyone choosing.
   */
  workspaceId?: string
}

export function HierarchicalSection({
  dateStr,
  sectionType,
  title,
  items,
  workspaceId,
}: HierarchicalSectionProps) {
  const [isOpen, setIsOpen] = useState(true)
  const { setDraggedItem, setDropTarget, dropTarget, setFocusedItemId } = useDashboardStore((s) => ({
    setDraggedItem: s.actions.setDraggedItem,
    setDropTarget: s.actions.setDropTarget,
    draggedItem: s.draggedItem,
    dropTarget: s.dropTarget,
    setFocusedItemId: s.actions.setFocusedItemId,
  }))


  const createActionItem = useCreateActionItem()
  const updateActionItem = useUpdateActionItem()
  const deleteActionItem = useDeleteActionItem()
  const createJournalEntry = useCreateJournalEntry()
  const updateJournalEntry = useUpdateJournalEntry()
  const deleteJournalEntry = useDeleteJournalEntry()
  // handleFullUpdate changes a block's type (e.g. note→journal_entry in
  // drag-drop). That is a substrate mutation with no domain route.
  const updateBlock = useUpdateBlock()

  /**
   * Writes the edit to whichever field this entry speaks through.
   *
   * Writing `text` unconditionally stranded every correction to a voice note:
   * nothing reads `text` when `summary` is present, so the edit saved and then
   * vanished on reload. `entryEditPatch` also stamps `editedAt`, which is what
   * tells the summary generator to prefer the correction over the original
   * transcription — without it, a fixed entry is silently re-outranked.
   */
  const handleUpdate = (id: string, newText: string) => {
    if (sectionType === 'action') {
      updateActionItem.mutate({ id, body: { text: newText } })
    } else {
      updateJournalEntry.mutate({ id, text: newText, workspaceId })
    }
  }

  const handleToggle = (id: string) => {
    const item = findItemAndParent(items, id)?.item
    if (item) {
      updateBlock.mutate({
        id,
        updateDto: { properties: { completed: !item.properties.completed } },
      })
    }
  }

  const handleAdd = (afterId: string | null, parentId: string | null) => {
    if (sectionType === 'action') {
      createActionItem.mutate(
        { text: '', parentId: parentId ?? undefined, workspaceId },
        { onSuccess: (created) => setFocusedItemId(created.id) },
      )
    } else {
      createJournalEntry.mutate(
        { text: '', date: dateStr, workspaceId },
        { onSuccess: (created) => setFocusedItemId(created.id) },
      )
    }
  }

  const handleDelete = (id: string) => {
    if (sectionType === 'action') {
      deleteActionItem.mutate(id)
    } else {
      deleteJournalEntry.mutate({ id, workspaceId })
    }
  }

  const handleIndent = (id: string) => {
    const found = findItemAndParent(items, id)
    if (found && found.index > 0) {
      const newParent = found.parentList[found.index - 1]
      if (newParent) {
        if (sectionType === 'action') {
          updateActionItem.mutate({ id, body: { parentId: newParent.id } }, { onSuccess: () => setFocusedItemId(id) })
        } else {
          updateBlock.mutate({ id, updateDto: { parentId: newParent.id } }, { onSuccess: () => setFocusedItemId(id) })
        }
      }
    }
  }

  const handleOutdent = (id: string) => {
    const found = findItemAndParent(items, id)
    if (found && found.parent) {
      const grandParentInfo = findItemAndParent(items, found.parent.id)
      const newParentId = grandParentInfo?.parent?.id || null
      if (sectionType === 'action') {
        updateActionItem.mutate({ id, body: { parentId: newParentId } }, { onSuccess: () => setFocusedItemId(id) })
      } else {
        updateBlock.mutate({ id, updateDto: { parentId: newParentId } }, { onSuccess: () => setFocusedItemId(id) })
      }
    }
  }

  const handleDragStart = (e: React.DragEvent, item: Block) => {
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem(item)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDropTarget(null)
  }

  const handleSectionDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const currentDraggedItem = useDashboardStore.getState().draggedItem
    // Allow dropping notes onto action/experience sections
    if (!currentDraggedItem || (currentDraggedItem.type !== sectionType && currentDraggedItem.type !== 'note')) {
      setDropTarget(null)
      return
    }
    if (isOpen) {
      setDropTarget({
        id: null,
        position: 'end',
        date: dateStr,
        section: sectionType,
      })
    }
  }

  const handleFullUpdate = (id: string, dto: { type?: string; properties?: Record<string, unknown> }) => {
    updateBlock.mutate({
      id,
      updateDto: dto,
    })
  }

  const renderList = (
    itemList: HierarchicalBlock[],
    parentListForContext: HierarchicalBlock[],
    level = 0
  ): JSX.Element => (
    <>
      {itemList.map((item, index) => (
        <div key={item.id} style={{ marginLeft: `${level > 0 ? 1.5 : 0}rem` }}>
          <EditableItem
            item={item}
            onUpdate={handleUpdate}
            onFullUpdate={handleFullUpdate}
            onToggle={handleToggle}
            onAddItem={handleAdd}
            onIndent={handleIndent}
            onOutdent={handleOutdent}
            onDelete={handleDelete}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            parentList={parentListForContext}
            index={index}
          />
          {item.children?.length > 0 && renderList(item.children, item.children, level + 1)}
        </div>
      ))}
    </>
  )

  return (
    <div className="mb-4">
      <button
        className="flex items-center w-full text-left p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
        onDragOver={handleSectionDragOver}
      >
        {isOpen ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
      </button>
      {isOpen && (
        <div className="pl-2 mt-2" onDragOver={handleSectionDragOver}>
          {items.length > 0 ? (
            renderList(items, items)
          ) : (
            <div
              className="text-gray-500 italic text-sm pl-8 cursor-pointer h-10 flex items-center"
              onClick={() => handleAdd(null, null)}
            >
              Click to add an entry.
            </div>
          )}
          {dropTarget?.section === sectionType && dropTarget.position === 'end' && dropTarget.id === null && (
            <div className="relative h-1">
              <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-blue-500 rounded-full z-10" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
