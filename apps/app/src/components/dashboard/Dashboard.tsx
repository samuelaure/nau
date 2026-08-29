'use client'

import { useMemo, useRef, useEffect } from 'react'
import { Block } from '@9nau/types'
import { PeriodBlock, type PeriodContents } from './PeriodBlock'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useUiStore } from '@/lib/state/ui-store'
import { usePeriodAgenda } from './usePeriodAgenda'
import { usePeriodAt, usePeriodsIn } from '@/relations/app-time/use-periods'
import { NextActions } from './NextActions'
import { HierarchicalBlock, findItemAndParent, calculateSortOrder } from '@9nau/core'
import { Button } from '@9nau/ui/components/button'
import { ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, X } from 'lucide-react'
import { useUpdateBlock } from '@/hooks/use-blocks-api'
import { cn } from '@9nau/ui/lib/utils'
import {
  isCurrent,
  periodAnchors,
  stepAnchor,
  subGranularity,
  toKey,
  toSlot,
  type Granularity,
  type PeriodSlot,
} from '@/relations/app-actions/periods'

interface DashboardProps {
  notesByDate: Map<string, Block[]>
  /** Every action block, for text, tree and editing. What is *owed* comes from the agenda. */
  actions: HierarchicalBlock[]
  experiences: HierarchicalBlock[]
}

export function Dashboard({ notesByDate, actions, experiences }: DashboardProps) {
  const {
    viewMode,
    currentDate,
    setCurrentDate,
    granularity,
    setGranularity,
    visiblePast,
    visibleFuture,
    loadMorePast,
    loadMoreFuture,
    hideFuture,
    mainContentRef,
    setTodayRef,
    draggedItem,
    dropTarget,
    setDraggedItem,
    setDropTarget,
  } = useDashboardStore((s) => ({
    viewMode: s.viewMode,
    currentDate: s.currentDate,
    setCurrentDate: s.actions.setCurrentDate,
    granularity: s.granularity,
    setGranularity: s.actions.setGranularity,
    visiblePast: s.visiblePast,
    visibleFuture: s.visibleFuture,
    loadMorePast: s.actions.loadMorePast,
    loadMoreFuture: s.actions.loadMoreFuture,
    hideFuture: s.actions.hideFuture,
    mainContentRef: s.mainContentRef,
    setTodayRef: s.actions.setTodayRef,
    draggedItem: s.draggedItem,
    dropTarget: s.dropTarget,
    setDraggedItem: s.actions.setDraggedItem,
    setDropTarget: s.actions.setDropTarget,
  }))

  const updateBlock = useUpdateBlock()
  const todayRef = useRef<HTMLDivElement>(null)
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)

  useEffect(() => {
    setTodayRef(todayRef)
  }, [todayRef, setTodayRef])

  // The anchors on screen — not periods yet. Resolving where a week starts is
  // the server's job now (`usePeriodsIn`, just below), not something computed
  // here and kept "in sync" with the server by a comment. This is what fixed
  // a workspace whose week began on Sunday creating items in one range and
  // seeing them in another.
  const anchors = useMemo(
    () => periodAnchors(granularity, visiblePast, visibleFuture, new Date()),
    [granularity, visiblePast, visibleFuture],
  )

  const anchorSpan = useMemo(() => {
    if (anchors.length === 0) return null
    const times = anchors.map((a) => a.getTime())
    return { from: toKey(new Date(Math.min(...times))), to: toKey(new Date(Math.max(...times))) }
  }, [anchors])

  const { data: periodsData } = usePeriodsIn({
    scale: granularity,
    from: anchorSpan?.from ?? '',
    to: anchorSpan?.to ?? '',
    workspaceId: anchorSpan ? activeWorkspaceId ?? null : null,
  })

  const slots = useMemo(() => (periodsData?.periods ?? []).map(toSlot), [periodsData])

  // Which period something appears under is decided by its schedule. The blocks
  // still carry the text and the tree; the agenda decides what is owed, which is
  // the only way one recurring block can show up across many periods.
  const { byPeriod } = usePeriodAgenda(slots)

  const blocksById = useMemo(() => {
    const map = new Map<string, Block>()
    const walk = (list: HierarchicalBlock[]) => {
      for (const b of list) {
        map.set(b.id, b)
        if (b.children?.length) walk(b.children)
      }
    }
    walk(actions)
    return map
  }, [actions])

  /**
   * Everything that belongs to a period.
   *
   * Occurrences come from the schedule; experiences and captures come from the
   * date they were filed under. Two different questions about time, answered
   * from the two places that hold them.
   */
  const contentsOf = useMemo(() => {
    return (slot: PeriodSlot): PeriodContents => {
      const inSlot = (b: { properties: Record<string, unknown> }) => {
        const raw = b.properties.date as string | undefined
        if (!raw) return false
        const d = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw)
        return d >= slot.start && d <= slot.end
      }

      const notes: Block[] = []
      notesByDate.forEach((list, dateStr) => {
        const d = new Date(`${dateStr}T12:00:00`)
        if (d >= slot.start && d <= slot.end) notes.push(...list)
      })

      return {
        occurrences: byPeriod.get(slot.key) ?? [],
        experiences: experiences.filter(inSlot),
        notes: notes
          .filter((n) => n.properties.status === 'inbox')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      }
    }
  }, [byPeriod, experiences, notesByDate])

  // Scrolling loads the past and only the past.
  //
  // The future is behind a button on purpose. The current period is drawn at the
  // top of the list, so a scroll-to-top trigger fires on first render and then
  // again on every scroll event while up there — each one widening the window
  // and refetching. Measured in production: enough requests to trip the API's
  // rate limiter, which is what made the whole app feel slow and made some
  // writes fail outright.
  useEffect(() => {
    const el = mainContentRef?.current
    if (viewMode !== 'list' || !el) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight - scrollTop - clientHeight < 200) loadMorePast()
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [viewMode, mainContentRef, loadMorePast])

  const handleDrop = () => {
    if (!draggedItem || !dropTarget) return

    if (
      draggedItem.type === 'note' &&
      (dropTarget.section === 'action' || dropTarget.section === 'journal_entry')
    ) {
      updateBlock.mutate({
        id: draggedItem.id,
        updateDto: {
          type: dropTarget.section,
          properties: {
            ...draggedItem.properties,
            text: draggedItem.properties.text || '',
            status: 'inbox',
            date: dropTarget.date,
          },
        },
      })
      setDraggedItem(null)
      setDropTarget(null)
      return
    }

    if (draggedItem.id === dropTarget.id || draggedItem.type === 'note') {
      setDraggedItem(null)
      setDropTarget(null)
      return
    }

    const allItems = draggedItem.type === 'action' ? actions : experiences

    const isDroppingOnChild = (item: Block, parentId: string | null): boolean => {
      if (!parentId) return false
      if (item.id === parentId) return true
      const parentInfo = findItemAndParent(allItems, parentId)
      return parentInfo?.parent ? isDroppingOnChild(item, parentInfo.parent.id) : false
    }
    if (isDroppingOnChild(draggedItem, dropTarget.id)) {
      setDraggedItem(null)
      setDropTarget(null)
      return
    }

    let newParentId: string | null = draggedItem.parentId
    let newSortOrder: number | undefined
    const newProperties: Record<string, unknown> = {}

    if (dropTarget.id) {
      const targetItemInfo = findItemAndParent(allItems, dropTarget.id)
      if (!targetItemInfo) return

      if (dropTarget.position === 'on') {
        newParentId = targetItemInfo.item.id
        const lastChild = targetItemInfo.item.children?.[targetItemInfo.item.children.length - 1]
        newSortOrder = (lastChild?.properties.sortOrder || 0) + 1
      } else if (dropTarget.position === 'above' || dropTarget.position === 'below') {
        newParentId = targetItemInfo.parent?.id ?? null
        newSortOrder = calculateSortOrder(
          targetItemInfo.parentList,
          targetItemInfo.index,
          dropTarget.position,
        )
      }
    } else {
      newParentId = null
      const rootItems = allItems.filter(
        (i) => i.id !== draggedItem.id && !i.parentId && i.properties.date === dropTarget.date,
      )
      const lastRootItem = rootItems[rootItems.length - 1]
      newSortOrder = (lastRootItem?.properties.sortOrder || 0) + 1
    }

    if ((draggedItem.properties.date as string) !== dropTarget.date) {
      newProperties.date = dropTarget.date
      if (dropTarget.position !== 'on') newParentId = null
    }

    const hasChanged =
      newParentId !== draggedItem.parentId ||
      (newSortOrder !== undefined && newSortOrder !== (draggedItem.properties.sortOrder as number)) ||
      Object.keys(newProperties).length > 0

    if (hasChanged) {
      updateBlock.mutate({
        id: draggedItem.id,
        updateDto: {
          parentId: newParentId,
          properties: { ...newProperties, sortOrder: newSortOrder },
        },
      })
    }

    setDraggedItem(null)
    setDropTarget(null)
  }

  /** Switches the whole list to the grain one level down, starting at this period. */
  const drillDown = (slot: PeriodSlot) => {
    const sub: Granularity =
      slot.granularity === 'quarter' || slot.granularity === 'year' ? 'month' : 'day'
    setCurrentDate(slot.start)
    setGranularity(sub)
  }

  const renderSubPeriod = (parent: PeriodSlot) => (
    <SubPeriods
      parent={parent}
      contentsOf={contentsOf}
      blocksById={blocksById}
      workspaceId={activeWorkspaceId ?? undefined}
    />
  )

  const containerProps = { onDrop: handleDrop, 'data-testid': 'dashboard-main-content' }

  if (viewMode === 'horizontal') {
    return (
      <HorizontalPeriod
        currentDate={currentDate}
        granularity={granularity}
        setCurrentDate={setCurrentDate}
        todayRef={todayRef}
        contentsOf={contentsOf}
        blocksById={blocksById}
        workspaceId={activeWorkspaceId ?? undefined}
        renderSubPeriod={renderSubPeriod}
        containerProps={containerProps}
      />
    )
  }

  return (
    <div {...containerProps} className="relative space-y-6">
      {/* Above the periods, because it belongs to none of them. */}
      <NextActions />

      {/* Deliberately a button and not a scroll trigger. See the effect above. */}
      <div className="flex items-center justify-center text-gray-500">
        <button
          onClick={loadMoreFuture}
          className="flex flex-grow items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
        >
          <ArrowUp className="h-4 w-4" />
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider">Futuro</span>
        </button>
        {visibleFuture > 0 && (
          <button
            onClick={hideFuture}
            className="ml-2 rounded-lg p-1.5 text-sm font-semibold transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Ocultar futuro"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {slots.map((slot) => (
        <div key={slot.key} ref={isCurrent(slot) ? todayRef : null}>
          <PeriodBlock
            slot={slot}
            contents={contentsOf(slot)}
            blocksById={blocksById}
            workspaceId={activeWorkspaceId ?? undefined}
            onDrillDown={drillDown}
            renderSubPeriod={renderSubPeriod}
          />
        </div>
      ))}

      <button
        onClick={loadMorePast}
        className="flex w-full items-center justify-center rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
      >
        <ArrowDown className="h-4 w-4" />
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider">Pasado</span>
      </button>
    </div>
  )
}

/**
 * The one period shown in horizontal mode, resolved by the server.
 *
 * Its own component rather than inline in `Dashboard`, because it needs its
 * own `usePeriodAt` call and a hook cannot be called conditionally inside the
 * `viewMode === 'horizontal'` branch above.
 */
function HorizontalPeriod({
  currentDate,
  granularity,
  setCurrentDate,
  todayRef,
  contentsOf,
  blocksById,
  workspaceId,
  renderSubPeriod,
  containerProps,
}: {
  currentDate: Date
  granularity: Granularity
  setCurrentDate: (date: Date) => void
  todayRef: React.RefObject<HTMLDivElement>
  contentsOf: (slot: PeriodSlot) => PeriodContents
  blocksById: Map<string, Block>
  workspaceId?: string
  renderSubPeriod: (parent: PeriodSlot) => React.ReactNode
  containerProps: { onDrop: () => void; 'data-testid': string }
}) {
  const { data } = usePeriodAt({
    scale: granularity,
    at: currentDate.toISOString(),
    workspaceId: workspaceId ?? null,
  })
  const slot = data?.period ? toSlot(data.period) : null

  const step = (offset: number) => {
    if (!slot) return
    setCurrentDate(stepAnchor(slot.start, granularity, offset))
  }

  if (!slot) return null

  return (
    <div {...containerProps} className="relative">
      <div className="mb-2 flex items-center justify-center space-x-1">
        <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous">
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <h2 className="w-64 text-center text-base font-semibold capitalize text-gray-700 dark:text-gray-200">
          {slot.label}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Next">
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
      <div ref={isCurrent(slot) ? todayRef : null}>
        <PeriodBlock
          showHeader={false}
          slot={slot}
          contents={contentsOf(slot)}
          blocksById={blocksById}
          workspaceId={workspaceId}
          renderSubPeriod={renderSubPeriod}
        />
      </div>
    </div>
  )
}

/**
 * A period's children, one level down, resolved by the server.
 *
 * Its own component for the same reason as `HorizontalPeriod`: resolving a
 * range of sub-periods needs `usePeriodsIn`, and `PeriodBlock` calls
 * `renderSubPeriod` from inside a conditional (`showSubPeriods`), where a hook
 * cannot live.
 */
function SubPeriods({
  parent,
  contentsOf,
  blocksById,
  workspaceId,
}: {
  parent: PeriodSlot
  contentsOf: (slot: PeriodSlot) => PeriodContents
  blocksById: Map<string, Block>
  workspaceId?: string
}) {
  const sub = subGranularity(parent.granularity)

  const { data } = usePeriodsIn({
    scale: sub ?? 'day',
    from: toKey(parent.start),
    to: toKey(parent.end),
    workspaceId: sub ? workspaceId ?? null : null,
  })

  if (!sub) return null
  const subSlots = (data?.periods ?? []).map(toSlot)

  return (
    <>
      {subSlots.map((slot) => (
        <PeriodBlock
          key={slot.key}
          slot={slot}
          contents={contentsOf(slot)}
          blocksById={blocksById}
          workspaceId={workspaceId}
        />
      ))}
    </>
  )
}
