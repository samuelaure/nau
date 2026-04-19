'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Film,
  Play,
  Mic,
  LayoutGrid,
  ImageIcon,
  Loader2,
  Calendar,
  CalendarCheck,
} from 'lucide-react'
import { cn } from '@/modules/shared/utils'

const FORMAT_ICON: Record<string, React.ElementType> = {
  reel: Film,
  trial_reel: Play,
  head_talk: Mic,
  carousel: LayoutGrid,
  static_post: ImageIcon,
  story: Play,
}

const FORMAT_LABEL: Record<string, string> = {
  reel: 'Reel',
  trial_reel: 'Trial Reel',
  head_talk: 'Head Talk',
  carousel: 'Carousel',
  static_post: 'Image',
}

type CalendarComposition = {
  id: string
  format: string
  status: string
  scheduledAt: string | null
  caption: string | null
  createdAt: string
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AccountCalendar({ accountId }: { accountId: string }) {
  const [compositions, setCompositions] = useState<CalendarComposition[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [rescheduling, setRescheduling] = useState<{ id: string; current: string } | null>(null)
  const [newDatetime, setNewDatetime] = useState('')

  const fetchCompositions = useCallback(async () => {
    try {
      const res = await fetch(`/api/compositions?accountId=${accountId}&calendar=1`)
      const data = await res.json()
      setCompositions(data.compositions || [])
    } catch {
      toast.error('Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchCompositions()
  }, [fetchCompositions])

  const handleConfirm = async (id: string) => {
    setActioningId(id)
    try {
      const res = await fetch(`/api/compositions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SCHEDULED' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Slot confirmed — composition is now scheduled for rendering.')
      fetchCompositions()
    } catch {
      toast.error('Failed to confirm slot')
    } finally {
      setActioningId(null)
    }
  }

  const handleReschedule = async () => {
    if (!rescheduling || !newDatetime) return
    setActioningId(rescheduling.id)
    try {
      const res = await fetch(`/api/compositions/${rescheduling.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: new Date(newDatetime).toISOString() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Slot rescheduled.')
      setRescheduling(null)
      setNewDatetime('')
      fetchCompositions()
    } catch {
      toast.error('Failed to reschedule')
    } finally {
      setActioningId(null)
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const compositionsForDay = (day: Date) =>
    compositions.filter((c) => c.scheduledAt && isSameDay(new Date(c.scheduledAt), day))

  const unslotted = compositions.filter((c) => !c.scheduledAt && c.status === 'APPROVED')

  const prevWeek = () => setWeekStart((d) => addDays(d, -7))
  const nextWeek = () => setWeekStart((d) => addDays(d, 7))
  const goToday = () => setWeekStart(startOfWeek(new Date()))

  const today = new Date()

  const suggestedCount = compositions.filter((c) => c.status === 'APPROVED' && c.scheduledAt).length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-heading font-semibold">Content Calendar</h3>
          <p className="text-xs text-gray-500">
            Suggested slots require confirmation before rendering begins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={prevWeek} className="px-2">
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-white min-w-[160px] text-center">
            {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {addDays(weekStart, 6).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <Button variant="outline" size="sm" onClick={nextWeek} className="px-2">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Banners */}
      {suggestedCount > 0 && (
        <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 rounded-lg px-4 py-3">
          <Clock className="w-4 h-4 text-purple-400 shrink-0" />
          <p className="text-sm text-purple-300">
            <strong>{suggestedCount}</strong> suggested {suggestedCount === 1 ? 'slot' : 'slots'}{' '}
            awaiting confirmation before rendering begins.
          </p>
        </div>
      )}
      {unslotted.length > 0 && (
        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-3">
          <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
          <p className="text-sm text-orange-300">
            <strong>{unslotted.length}</strong> approved{' '}
            {unslotted.length === 1 ? 'composition' : 'compositions'} not yet assigned to a slot.
            Run the scheduler cron or set up Auto-Schedule in Personas.
          </p>
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduling && (
        <Card className="bg-gray-900 border border-purple-500/30 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-white">Reschedule Composition</p>
          <p className="text-xs text-gray-500">
            Current slot:{' '}
            {new Date(rescheduling.current).toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <input
            type="datetime-local"
            value={newDatetime}
            onChange={(e) => setNewDatetime(e.target.value)}
            className="bg-gray-950 border border-gray-800 text-white rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRescheduling(null)
                setNewDatetime('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newDatetime || actioningId === rescheduling.id}
              onClick={handleReschedule}
            >
              {actioningId === rescheduling.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                'Confirm Reschedule'
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Weekly grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="animate-spin w-5 h-5 mr-2" />
          Loading calendar...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 min-h-[400px]">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today)
            const dayComps = compositionsForDay(day)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'flex flex-col gap-1 rounded-lg p-2 border',
                  isToday ? 'border-accent/50 bg-accent/5' : 'border-gray-800 bg-gray-900/40',
                )}
              >
                {/* Day header */}
                <div className="text-center mb-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                    {DAY_LABELS[day.getDay()]}
                  </p>
                  <p className={cn('text-sm font-bold', isToday ? 'text-accent' : 'text-white')}>
                    {day.getDate()}
                  </p>
                </div>

                {/* Slots */}
                {dayComps.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-[10px] text-gray-700">—</span>
                  </div>
                ) : (
                  dayComps.map((comp) => {
                    const isSuggested = comp.status === 'APPROVED'
                    const isScheduled = comp.status === 'SCHEDULED'
                    const FormatIcon = FORMAT_ICON[comp.format] ?? Film
                    const busy = actioningId === comp.id
                    const timeStr = comp.scheduledAt
                      ? new Date(comp.scheduledAt).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''

                    return (
                      <div
                        key={comp.id}
                        className={cn(
                          'rounded p-1.5 flex flex-col gap-1 text-[10px] border',
                          isSuggested
                            ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                            : isScheduled
                              ? 'bg-green-500/10 border-green-500/30 text-green-300'
                              : 'bg-gray-800 border-gray-700 text-gray-400',
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <FormatIcon size={9} className="shrink-0" />
                          <span className="font-bold truncate">
                            {FORMAT_LABEL[comp.format] ?? comp.format}
                          </span>
                        </div>
                        <span className="text-[9px] opacity-60">{timeStr}</span>
                        {isSuggested && (
                          <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">
                            Suggested
                          </span>
                        )}
                        {isScheduled && (
                          <span className="text-[9px] text-green-400 font-bold uppercase tracking-wider flex items-center gap-0.5">
                            <CalendarCheck size={8} />
                            Scheduled
                          </span>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {isSuggested && (
                            <button
                              disabled={busy}
                              onClick={() => handleConfirm(comp.id)}
                              className="flex items-center gap-0.5 text-[9px] text-green-400 hover:text-green-300 disabled:opacity-40 transition"
                            >
                              {busy ? (
                                <Loader2 size={8} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={8} />
                              )}
                              Confirm
                            </button>
                          )}
                          {comp.scheduledAt && (
                            <button
                              onClick={() =>
                                setRescheduling({ id: comp.id, current: comp.scheduledAt! })
                              }
                              className="text-[9px] text-gray-500 hover:text-white transition"
                            >
                              Reschedule
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Unslotted APPROVED compositions */}
      {!loading && unslotted.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">
            Unslotted Approved Compositions
          </p>
          <div className="flex flex-wrap gap-2">
            {unslotted.map((comp) => {
              const FormatIcon = FORMAT_ICON[comp.format] ?? Film
              return (
                <div
                  key={comp.id}
                  className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400"
                >
                  <FormatIcon size={12} />
                  <span>{FORMAT_LABEL[comp.format] ?? comp.format}</span>
                  <span className="text-gray-600">
                    {new Date(comp.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
