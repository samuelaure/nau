'use client'

import { useMemo } from 'react'
import { NoteInput } from '@/components/notes/note-input'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { JournalView } from '@/components/journal/JournalView'
import { AgendaView } from '@/components/agenda/AgendaView'
import { SearchView } from '@/components/search/SearchView'
import { ProjectsView } from '@/components/projects/ProjectsView'
import { useGetNotes, type Note } from '@/references/use-notes'
import { useGetActionItems, type ActionItem } from '@/actions/use-action-items'
import { groupBlocksByDate, buildHierarchy, formatDisplayDate } from '@9nau/core'
import { Block } from '@9nau/types'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useUiStore } from '@/lib/state/ui-store'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { NoteGrid } from '@/components/notes/NoteGrid'

/**
 * Adapts a domain-module row (`Note`, `ActionItem`) onto the `Block` shape
 * `buildHierarchy`/`groupBlocksByDate` (packages/nau-core) already understand.
 *
 * Deliberately local and disposable rather than a change to those helpers:
 * `nau-core`'s hierarchy/grouping logic only reads `id`, `parentId`,
 * `properties.sortOrder`, `properties.date`/`createdAt` and `properties.text`
 * — none of that is Journal/Actions/References' domain, it's tree and date
 * bookkeeping any kind needs. Reshaping the two rows that already carry
 * everything it needs is cheaper and lower-risk than teaching those helpers
 * five modules' response shapes, and it can be deleted the day `Dashboard`
 * and `NoteGrid` are rebuilt to read `Note`/`ActionItem` natively (nau#136's
 * remaining scope).
 */
function noteToBlock(note: Note): Block {
  return {
    id: note.id,
    type: 'note',
    properties: {
      text: note.properties.content,
      title: note.properties.title,
      sortOrder: note.properties.sortOrder,
    },
    parentId: note.parentId,
    uuid: note.uuid,
    source: note.source,
    sourceRef: note.sourceRef,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: null,
  }
}

function actionToBlock(action: ActionItem): Block {
  return {
    id: action.id,
    type: 'action',
    properties: {
      text: action.properties.text,
      status: action.properties.status,
      priority: action.properties.priority,
      deadline: action.properties.deadline,
      estimateMinutes: action.properties.estimateMinutes,
      sortOrder: action.properties.sortOrder,
    },
    parentId: action.parentId,
    uuid: action.uuid,
    source: null,
    sourceRef: null,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    deletedAt: null,
  }
}

export default function HomePage() {
  const activeWorkspaceId = useActiveWorkspaceId()
  const activeView = useUiStore((s) => s.activeView)
  const setAllBlocks = useDashboardStore((s) => s.actions.setAllBlocks)

  const {
    data: notesData,
    isLoading: notesLoading,
    isError: notesError,
  } = useGetNotes({ workspaceId: activeWorkspaceId })
  const {
    data: actionsData,
    isLoading: actionsLoading,
    isError: actionsError,
  } = useGetActionItems({ workspaceId: activeWorkspaceId })

  const isLoading = notesLoading || actionsLoading
  const isError = notesError || actionsError

  const blocks = useMemo(() => {
    const notes = (notesData ?? []).map(noteToBlock)
    const actions = (actionsData ?? []).map(actionToBlock)
    return [...notes, ...actions]
  }, [notesData, actionsData])

  useMemo(() => {
    if (blocks.length > 0 || (notesData && actionsData)) {
      setAllBlocks(blocks)
    }
  }, [blocks, notesData, actionsData, setAllBlocks])

  const processedData = useMemo(() => {
    const notes = blocks.filter((b: Block) => b.type === 'note')
    const actions = blocks.filter((b: Block) => b.type === 'action')
    // Journal has its own view (JournalView, below) reading journal.entry
    // directly — it never joins the block list here any more (nau#134).
    const experiences: Block[] = []

    const notesByDate = groupBlocksByDate(notes)
    const actionsHierarchy = buildHierarchy(actions)
    const experiencesHierarchy = buildHierarchy(experiences)

    const groupedNotes = notes
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .reduce(
        (acc, note) => {
          const dateProp = note.properties.date as string | undefined
          const dateKey = formatDisplayDate(dateProp || new Date(note.createdAt).toISOString().split('T')[0])
          if (!acc[dateKey]) {
            acc[dateKey] = []
          }
          acc[dateKey].push(note)
          return acc
        },
        {} as Record<string, Block[]>
      )

    return { notesByDate, actionsHierarchy, experiencesHierarchy, groupedNotes }
  }, [blocks])

  if (isLoading) {
    return <div className="text-center text-gray-500 dark:text-gray-400 mt-10">Loading data...</div>
  }

  if (isError) {
    return <div className="text-center text-red-500 mt-10">Failed to load data. Please try again later.</div>
  }

  // Route to special views
  if (activeView === 'agenda') {
    return <AgendaView />
  }

  if (activeView === 'journal') {
    return <JournalView />
  }

  if (activeView === 'search') {
    return <SearchView />
  }

  if (activeView === 'projects') {
    return <ProjectsView />
  }

  return (
    <>
      <NoteInput />
      {activeView === 'home' ? (
        <Dashboard
          notesByDate={processedData.notesByDate}
          actions={processedData.actionsHierarchy}
          experiences={processedData.experiencesHierarchy}
        />
      ) : (
        <div className="space-y-8">
          {Object.keys(processedData.groupedNotes).length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-20">This section is empty.</div>
          ) : (
            Object.entries(processedData.groupedNotes).map(([date, notesForDate]) => (
              <div key={date}>
                <div className="flex items-center mb-4">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pr-3 whitespace-nowrap">
                    {date}
                  </div>
                  <div className="flex-grow h-px bg-gray-200 dark:bg-gray-700"></div>
                </div>
                <NoteGrid notes={notesForDate} />
              </div>
            ))
          )}
        </div>
      )}
    </>
  )
}

