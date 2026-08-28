'use client'

import React, { useState, useMemo } from 'react'
import { useGetBlocks, useUpdateBlock } from '@/hooks/use-blocks-api'
import { Block } from '@9nau/types'
import { ChevronLeft, ChevronRight, Sparkles, BookOpen, FileText } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { cn } from '@9nau/ui/lib/utils'
import { JournalCapture } from './JournalCapture'
import { EditableText } from './EditableText'
import { useUiStore } from '@/lib/state/ui-store'

type PeriodType = 'day' | 'week' | 'month' | 'year'

/** Types the journal timeline renders. Everything else is another module's. */
const JOURNAL_TYPES = ['journal_entry', 'journal_synthesis', 'note', 'action']

function getDateRange(date: Date, period: PeriodType): { start: Date; end: Date } {
  const d = new Date(date)
  switch (period) {
    case 'week': {
      const dayOfWeek = d.getDay()
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const start = new Date(d.setDate(diff))
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case 'month': {
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
    case 'year': {
      const start = new Date(d.getFullYear(), 0, 1)
      const end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)
      return { start, end }
    }
    case 'day':
    default:
      return { start: new Date(d.setHours(0, 0, 0, 0)), end: new Date(new Date(d).setHours(23, 59, 59, 999)) }
  }
}

function navigate(date: Date, period: PeriodType, direction: -1 | 1): Date {
  const d = new Date(date)
  switch (period) {
    case 'week':
      d.setDate(d.getDate() + 7 * direction)
      break
    case 'month':
      d.setMonth(d.getMonth() + direction)
      break
    case 'year':
      d.setFullYear(d.getFullYear() + direction)
      break
    default:
      d.setDate(d.getDate() + direction)
  }
  return d
}

function formatPeriodTitle(date: Date, period: PeriodType): string {
  switch (period) {
    case 'week': {
      const range = getDateRange(date, 'week')
      return `Semana del ${range.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} al ${range.end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    case 'month':
      return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    case 'year':
      return `Año ${date.getFullYear()}`
    default:
      return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
}

export function JournalView() {
  const activeWorkspaceId = useUiStore((st) => st.activeWorkspaceId)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [period, setPeriod] = useState<PeriodType>('day')

  const updateBlock = useUpdateBlock()

  const range = useMemo(() => getDateRange(currentDate, period), [currentDate, period])

  // Only the period being viewed, and only the types this view renders. It used
  // to request every block in the workspace — 968 Instagram captures included —
  // and filter in the browser to show a single day.
  const { data: allBlocks, isLoading } = useGetBlocks({
    types: JOURNAL_TYPES,
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    workspaceId: activeWorkspaceId ?? undefined,
  })

  const { entries, syntheses } = useMemo(() => {
    if (!allBlocks) return { entries: [], syntheses: [] }

    const byDate = (a: Block, b: Block) => {
      const da = ((a.properties as any)?.date as string) || a.createdAt
      const db = ((b.properties as any)?.date as string) || b.createdAt
      return new Date(da).getTime() - new Date(db).getTime()
    }

    return {
      entries: allBlocks
        .filter((b: Block) => b.type === 'journal_entry' || b.type === 'note' || b.type === 'action')
        .sort(byDate),
      syntheses: allBlocks
        .filter((b: Block) => b.type === 'journal_synthesis')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }
  }, [allBlocks])

  /**
   * Writing an edit stamps `editedAt`, which tells the summary generator to read
   * this text instead of the original capture. A deliberate correction is more
   * authoritative than a transcription; `raw` keeps the original regardless.
   */
  const saveProperty = (block: Block, key: string, next: string) => {
    updateBlock.mutate({
      id: block.id,
      updateDto: { properties: { [key]: next, editedAt: new Date().toISOString() } },
    })
  }

  const periodButtons: { value: PeriodType; label: string }[] = [
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'year', label: 'Año' },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Journal</h1>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {periodButtons.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                period === p.value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Capture box, only on the day view: an entry written while looking at a
          month would be filed under today anyway, which is confusing. */}
      {period === 'day' && (
        <div className="mb-6">
          <JournalCapture />
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(navigate(currentDate, period, -1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="text-lg font-semibold text-gray-800 dark:text-gray-100 capitalize hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          {formatPeriodTitle(currentDate, period)}
        </button>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(navigate(currentDate, period, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {isLoading && (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-10">Cargando datos...</div>
      )}

      {/* The interpretation of a period: the account of it, then the reading of
          that account. Two model calls produced them and they are stored apart,
          but they are one piece of writing to read — which is why they sit in
          one card, synthesis first, with no heading between them competing for
          attention. Both are editable: what a model wrote is a first draft, and
          the person's correction of it is worth more. */}
      {syntheses.length > 0 && (
        <div className="mb-8 space-y-4">
          {syntheses.map((synthesis: Block) => {
            const props = synthesis.properties as any
            const from = props.from ? new Date(props.from as string) : null
            const to = props.to ? new Date(props.to as string) : null
            const fmt = (d: Date) =>
              d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

            return (
              <div
                key={synthesis.id}
                className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-6 border border-emerald-200/50 dark:border-emerald-800/50"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {from && to ? `${fmt(from)} — ${fmt(to)}` : 'Síntesis'}
                  </span>
                  {props.editedAt && (
                    <span className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60">editado</span>
                  )}
                </div>

                {props.noData ? (
                  <p className="text-sm italic text-gray-500 dark:text-gray-400">
                    No hay nada registrado en este periodo.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <EditableText
                      value={(props.synthesis as string) || ''}
                      label="la síntesis"
                      onSave={(next) => saveProperty(synthesis, 'synthesis', next)}
                      className="text-sm leading-relaxed text-gray-700 dark:text-gray-300"
                    />
                    {(props.reflection as string) && (
                      <div className="border-t border-emerald-200/60 pt-4 dark:border-emerald-800/40">
                        <EditableText
                          value={(props.reflection as string) || ''}
                          label="la reflexión"
                          onSave={(next) => saveProperty(synthesis, 'reflection', next)}
                          className="text-sm leading-relaxed text-gray-600 dark:text-gray-400"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {entries.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Entradas ({entries.length})
            </span>
          </div>
          {entries.map((entry: Block) => {
            const props = entry.properties as any
            // One field holds the entry now. `textOriginal` keeps what it said
            // before any edit, but this page shows what it says.
            const text = (props.text || '') as string
            const at = (props.date as string) || entry.createdAt
            const time = new Date(at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            const source = (props.source as string) || entry.source || ''

            return (
              <div
                key={entry.id}
                className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow group"
              >
                <div className="flex flex-col items-center">
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{time}</span>
                  <div className={cn(
                    'w-2 h-2 rounded-full mt-1',
                    entry.type === 'journal_entry' ? 'bg-emerald-400' :
                    entry.type === 'action' ? 'bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <EditableText
                    value={text}
                    label="la entrada"
                    placeholder="Sin contenido"
                    onSave={(next) => saveProperty(entry, 'text', next)}
                    className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">
                      {entry.type === 'journal_entry' ? '📓 Journal' : entry.type === 'action' ? '⚡ Action' : '📝 Note'}
                    </span>
                    {source && (
                      <span className="text-[10px] text-gray-300 dark:text-gray-600">• {source}</span>
                    )}
                    {props.originFormat === 'voice' && (
                      <span className="text-[10px] text-gray-300 dark:text-gray-600">• voz</span>
                    )}
                    {props.editedAt && (
                      <span className="text-[10px] text-gray-300 dark:text-gray-600">• editado</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        !isLoading && (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-400 dark:text-gray-500">No hay entradas para este período</p>
          </div>
        )
      )}
    </div>
  )
}
