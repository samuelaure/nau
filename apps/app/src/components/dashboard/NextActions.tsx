'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Inbox } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { cn } from '@9nau/ui/lib/utils'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { useUpdateActionItem } from '@/actions/use-action-items'

interface NextAction {
  blockId: string
  type: string
  title: string
  parentId: string | null
  sortOrder: number
  estimateMinutes: number | null
  priority: string | null
  createdAt: string
}

/**
 * Everything captured and not yet placed in time.
 *
 * An action with no schedule is a next action — a state with meaning, not a
 * leftover. It is where a capture waits until someone decides when it happens,
 * which is why triage deliberately creates without one: capturing is not
 * planning, and scheduling on the person's behalf takes that decision away.
 *
 * Sits above the periods rather than inside any of them, because it belongs to
 * none. Putting it under today would be making the decision it exists to leave
 * open.
 */
export function NextActions() {
  const activeWorkspaceId = useActiveWorkspaceId()
  const [isOpen, setIsOpen] = useState(true)
  const updateActionItem = useUpdateActionItem()

  const { data } = useQuery<{ items: NextAction[] }, Error>({
    queryKey: ['agenda', 'next', activeWorkspaceId],
    queryFn: () =>
      apiClient.get(`/agenda/next?workspaceId=${activeWorkspaceId}`),
    enabled: Boolean(activeWorkspaceId),
  })

  const items = data?.items ?? []
  if (items.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
        <Inbox className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Acciones siguientes
        </h3>
        <span className="text-[10px] font-medium text-gray-400">{items.length}</span>
        <span className="ml-auto text-[10px] text-gray-400">sin periodo asignado</span>
      </button>

      {isOpen && (
        <div className="space-y-1 px-3 pb-3">
          {items.map((item) => (
            <div
              key={item.blockId}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', item.blockId)
              }}
              className="group flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 active:cursor-grabbing dark:text-gray-300 dark:hover:bg-gray-700/50"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.estimateMinutes != null && (
                <span className="text-[10px] text-gray-400">{item.estimateMinutes} min</span>
              )}
              <button
                onClick={() =>
                  updateActionItem.mutate({
                    id: item.blockId,
                    body: { status: 'done' },
                  })
                }
                title="Completar sin planificar"
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] opacity-0 transition-opacity',
                  'text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100',
                  'dark:hover:bg-gray-600',
                )}
              >
                hecho
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
