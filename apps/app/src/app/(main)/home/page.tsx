'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGetNotes, type Note } from '@/references/use-notes'
import { useGetActionItems, type ActionItem } from '@/actions/use-action-items'
import { groupBlocksByDate, buildHierarchy, formatDisplayDate } from '@9nau/core'
import { Block } from '@9nau/types'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { CaptureBox } from '@/components/home/CaptureBox'
import { BandejaGeneral } from '@/components/home/BandejaGeneral'
import { ContentTopBar, type ContentTab } from '@/core/shell/content-topbar'
// TEMPORARY — the chatarrería (see content-topbar.tsx). Two parallel
// "actions" implementations, side by side under their own tabs, so their
// remaining function gets absorbed into one and these two — and the tabs —
// get deleted.
import { AgendaView } from '@/components/agenda/AgendaView'
import { Dashboard } from '@/components/dashboard/Dashboard'

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
  const [activeTab, setActiveTab] = useState<ContentTab>('bandeja')
  const activeWorkspaceId = useActiveWorkspaceId()
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

  useEffect(() => {
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

    return { notes, notesByDate, actionsHierarchy, experiencesHierarchy, groupedNotes }
  }, [blocks])

  return (
    <div>
      <ContentTopBar title="Inicio" activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="px-4 py-6 md:px-8">
        {activeTab === 'agendaView' ? (
          // TEMPORARY — see import comment above.
          <AgendaView />
        ) : activeTab === 'actionsSection' ? (
          // TEMPORARY — mounts the whole old Dashboard rather than
          // ActionsSection alone: ActionsSection needs the periods/agenda-
          // range plumbing Dashboard already assembles (usePeriodAgenda,
          // usePeriodsIn, slots) — reproducing that here just to isolate one
          // section would rebuild machinery this tab exists to retire, not
          // keep. Dashboard also still renders NextActions/notes/experiences
          // alongside it; that's the real current shape of "the vista with
          // the calendar icon", not just its actions.
          <div className="mx-auto max-w-6xl">
            <Dashboard
              notesByDate={processedData.notesByDate}
              actions={processedData.actionsHierarchy}
              experiences={processedData.experiencesHierarchy}
            />
          </div>
        ) : activeTab !== 'bandeja' ? (
          // Overview/Acciones/Journal/References/Ideas are intentionally
          // empty for now — only Bandeja (the GTD General tray,
          // Keep-equivalent) is being built in this pass.
          // JournalView/SearchView/ProjectsView still exist, just not
          // mounted onto any tab yet.
          <div className="mx-auto max-w-6xl py-16 text-center text-sm text-gray-400 dark:text-gray-500">
            Próximamente.
          </div>
        ) : isLoading ? (
          <div className="mt-10 text-center text-gray-500 dark:text-gray-400">Loading data...</div>
        ) : isError ? (
          <div className="mt-10 text-center text-red-500">Failed to load data. Please try again later.</div>
        ) : (
          <div className="mx-auto max-w-6xl">
            <CaptureBox />
            <BandejaGeneral notes={processedData.notes} />
          </div>
        )}
      </div>
    </div>
  )
}

