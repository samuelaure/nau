'use client'

import { useMemo, useRef, useEffect } from 'react'
import { Block } from '@9nau/types'
import { PeriodBlock, type PeriodContents } from './PeriodBlock'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useUiStore } from '@/lib/state/ui-store'
import { usePeriodAgenda } from './usePeriodAgenda'
import { useWorkspaceCalendar } from '@/hooks/use-calendar-api'
import { NextActions } from './NextActions'
import { HierarchicalBlock, findItemAndParent, calculateSortOrder } from '@9nau/core'
import { Button } from '@9nau/ui/components/button'
import { ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, X, Crosshair } from 'lucide-react'
import { useUpdateBlock } from '@/hooks/use-blocks-api'
import { cn } from '@9nau/ui/lib/utils'
import {
  GRANULARITIES,
  isCurrent,
  periodOf,
  periodRun,
  shiftPeriod,
  subPeriods,
  type Granularity,
  type PeriodSlot,
} from '@/lib/periods'

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

  // Fetched rather than assumed. Where a week starts belongs to the calendar,
  // and if this disagreed with the server the list would draw one week while the
  // summaries described another, with nothing to say so.
  const { data: calendar } = useWorkspaceCalendar()
  const calendarConfig = calendar?.config

  useEffect(() => {
    setTodayRef(todayRef)
  }, [todayRef, setTodayRef])

  const slots = useMemo(
    () => periodRun(granularity, visiblePast, visibleFuture, new Date(), calendarConfig),
    [granularity, visiblePast, visibleFuture, calendarConfig],
  )

  // Which period something appears under is decided by its schedule. The blocks
  // still carry the text and the tree; the agenda decides what is owed, which is
  // the only way one recurring block can show up across many periods.
  const { byPeriod } = usePeriodAgenda(slots, calendarConfig)

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

  // Infinite scroll in both directions: reaching either end widens the window
  // rather than paging, so moving through time never asks for a click.
  useEffect(() => {
    const el = mainContentRef?.current
    if (viewMode !== 'list' || !el) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight - scrollTop - clientHeight < 200) loadMorePast()
      if (scrollTop < 120) loadMoreFuture()
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [viewMode, mainContentRef, loadMorePast, loadMoreFuture])

  const handleDrop = () => {
    if (!draggedItem || !dropTarget) return

    if (
      draggedItem.type === 'note' &&
      (dropTarget.section === 'action' || dropTarget.section === 'experience')
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
    <>
      {subPeriods(parent, calendarConfig).map((sub) => (
        <PeriodBlock
          key={sub.key}
          slot={sub}
          contents={contentsOf(sub)}
          blocksById={blocksById}
          workspaceId={activeWorkspaceId ?? undefined}
        />
      ))}
    </>
  )

  /** What the period being lived now is called, at this grain. */
  const currentLabel = {
    day: 'Hoy',
    week: 'Semana actual',
    month: 'Mes actual',
    quarter: 'Trimestre actual',
    year: 'Año actual',
  }[granularity]

  const goToCurrent = () => {
    setCurrentDate(new Date())
    // Scrolling rather than reloading: the current period is already on screen
    // in every ordinary case, and jumping the window would lose the scroll
    // position the person built up getting here.
    todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const granularityPicker = (
    <div className="mb-4 flex items-center justify-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
      {GRANULARITIES.map((g) => (
        <button
          key={g.value}
          onClick={() => setGranularity(g.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-all',
            granularity === g.value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
          )}
        >
          {g.label}
        </button>
      ))}
    </div>
  )

  const currentButton = (
    <button
      onClick={goToCurrent}
      className="mx-auto mb-4 flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
    >
      <Crosshair className="h-3 w-3" />
      {currentLabel}
    </button>
  )

  const containerProps = { onDrop: handleDrop, 'data-testid': 'dashboard-main-content' }

  if (viewMode === 'horizontal') {
    const slot = periodOf(currentDate, granularity, calendarConfig)
    return (
      <div {...containerProps} className="relative">
        {granularityPicker}
        {currentButton}
        <div className="mb-2 flex items-center justify-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(shiftPeriod(slot, -1, calendarConfig).start)}
            aria-label="Previous"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <h2 className="w-64 text-center text-base font-semibold capitalize text-gray-700 dark:text-gray-200">
            {slot.label}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(shiftPeriod(slot, 1, calendarConfig).start)}
            aria-label="Next"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
        <div ref={isCurrent(slot) ? todayRef : null}>
          <PeriodBlock
            showHeader={false}
            slot={slot}
            contents={contentsOf(slot)}
            blocksById={blocksById}
            workspaceId={activeWorkspaceId ?? undefined}
            renderSubPeriod={renderSubPeriod}
          />
        </div>
      </div>
    )
  }

  return (
    <div {...containerProps} className="relative space-y-6">
      {granularityPicker}
      {currentButton}

      {/* Above the periods, because it belongs to none of them. */}
      <NextActions />

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
