'use client'

import React, { useState, useMemo } from 'react'
import { useGetBlocks, useUpdateBlock } from '@/hooks/use-blocks-api'
import { useCustomSummary } from '@/hooks/use-journal-api'
import { Block } from '@9nau/types'
import { ChevronLeft, ChevronRight, Sparkles, BookOpen, FileText, Activity, Wand2, Loader2 } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { cn } from '@9nau/ui/lib/utils'
import { JournalCapture } from './JournalCapture'
import { EditableText } from './EditableText'
import { EntryAudio } from './EntryAudio'
import { useUiStore } from '@/lib/state/ui-store'

type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom'

/** Types the journal timeline renders. Everything else is another module's. */
const JOURNAL_TYPES = ['journal_entry', 'journal_summary', 'journal_activity', 'note', 'action']

function toInputDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

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

  // Only meaningful in the custom period. Seeded to the last week so the inputs
  // are never empty.
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return toInputDate(d)
  })
  const [customEnd, setCustomEnd] = useState(() => toInputDate(new Date()))

  const updateBlock = useUpdateBlock()
  const customSummary = useCustomSummary()

  const range = useMemo(() => {
    if (period !== 'custom') return getDateRange(currentDate, period)
    // Read as local calendar days, which is what the person typed.
    return {
      start: new Date(`${customStart}T00:00:00`),
      end: new Date(`${customEnd}T23:59:59.999`),
    }
  }, [currentDate, period, customStart, customEnd])

  // Only the period being viewed, and only the types this view renders. It used
  // to request every block in the workspace — 968 Instagram captures included —
  // and filter in the browser to show a single day.
  const { data: allBlocks, isLoading } = useGetBlocks({
    types: JOURNAL_TYPES,
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    workspaceId: activeWorkspaceId ?? undefined,
  })

  const { entries, summaries, activity } = useMemo(() => {
    if (!allBlocks) return { entries: [], summaries: [], activity: [] }

    const byDate = (a: Block, b: Block) => {
      const da = ((a.properties as any)?.date as string) || a.createdAt
      const db = ((b.properties as any)?.date as string) || b.createdAt
      return new Date(da).getTime() - new Date(db).getTime()
    }

    return {
      entries: allBlocks
        .filter((b: Block) => b.type === 'journal_entry' || b.type === 'note' || b.type === 'action')
        .sort(byDate),
      activity: allBlocks.filter((b: Block) => b.type === 'journal_activity').sort(byDate),
      summaries: allBlocks
        .filter((b: Block) => b.type === 'journal_summary')
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
    { value: 'custom', label: 'Personalizado' },
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

      {period === 'custom' ? (
        <div className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            Desde
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            Hasta
            <input
              type="date"
              value={customEnd}
              min={customStart}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:text-gray-100"
            />
          </label>
          <button
            onClick={() =>
              customSummary.mutate({
                startDate: customStart,
                endDate: customEnd,
                workspaceId: activeWorkspaceId ?? undefined,
              })
            }
            disabled={customSummary.isPending || !activeWorkspaceId}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {customSummary.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Resumir este periodo
          </button>
          {customSummary.isError && (
            <span className="text-xs text-red-600">No se pudo generar el resumen.</span>
          )}
          {customSummary.data?.skipped && (
            <span className="text-xs text-gray-500">No hay nada registrado en ese rango.</span>
          )}
        </div>
      ) : (
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
      )}

      {isLoading && (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-10">Cargando datos...</div>
      )}

      {/* Summaries. Both halves are editable: a summary is a first draft written
          by a model, and the person's correction of it is worth more. */}
      {summaries.length > 0 && (
        <div className="mb-8 space-y-4">
          {summaries.map((summary: Block) => {
            const props = summary.properties as any
            return (
              <div
                key={summary.id}
                className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-6 border border-emerald-200/50 dark:border-emerald-800/50"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {(props.periodType as string) || 'Resumen'}
                  </span>
                  {props.editedAt && (
                    <span className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60">editado</span>
                  )}
                </div>
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-1">✨ Síntesis</h3>
                  <EditableText
                    value={(props.synthesis as string) || ''}
                    label="la síntesis"
                    onSave={(next) => saveProperty(summary, 'synthesis', next)}
                    className="text-sm leading-relaxed text-gray-700 dark:text-gray-300"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-teal-800 dark:text-teal-200 mb-1">📝 Resumen</h3>
                  <EditableText
                    value={(props.summary as string) || ''}
                    label="el resumen"
                    onSave={(next) => saveProperty(summary, 'summary', next)}
                    className="text-sm leading-relaxed text-gray-600 dark:text-gray-400"
                  />
                </div>
                {(props.highlights as string[])?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(props.highlights as string[]).map((h, i) => (
                      <span key={i} className="px-2 py-1 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Recorded activity. Kept visually apart from the entries because it is
          what the system observed, not what the person wrote — and confusing the
          two is what a journal must never do. */}
      {activity.length > 0 && (
        <div className="mb-8 space-y-3">
          {activity.map((block: Block) => {
            const props = block.properties as any
            return (
              <div
                key={block.id}
                className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-4 dark:border-gray-600 dark:bg-gray-800/40"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Actividad registrada
                  </span>
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">
                    {new Date((props.date as string) || block.createdAt).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {(props.summary as string) || ''}
                </p>
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
            // The readable version is shown. `raw` is the faithful one and is what
            // the summaries are built from, but it carries every hesitation of
            // speech and this is a page meant for reading.
            const text = (props.summary || props.text || props.name || '') as string
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
                    onSave={(next) => saveProperty(entry, props.summary !== undefined ? 'summary' : 'text', next)}
                    className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">
                      {entry.type === 'journal_entry' ? '📓 Journal' : entry.type === 'action' ? '⚡ Action' : '📝 Note'}
                    </span>
                    {source && (
                      <span className="text-[10px] text-gray-300 dark:text-gray-600">• {source}</span>
                    )}
                    {props.editedAt && (
                      <span className="text-[10px] text-gray-300 dark:text-gray-600">• editado</span>
                    )}
                    {props.audioKey && <EntryAudio audioKey={props.audioKey as string} />}
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
