'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Play,
  Mic,
  LayoutGrid,
  ImageIcon,
  Loader2,
  X,
  Clock,
  CheckCircle2,
  Send,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/modules/shared/utils'

// ─── Status config ────────────────────────────────────────────────────────────

// Four primary display statuses shown inside the calendar
type DisplayStatus = 'Draft' | 'Composed' | 'Published' | 'Error'

function getDisplayStatus(dbStatus: string): DisplayStatus {
  if (dbStatus === 'PUBLISHED') return 'Published'
  if (dbStatus === 'FAILED') return 'Error'
  if (dbStatus === 'RENDERED' || dbStatus === 'PUBLISHING') return 'Composed'
  // DRAFT, APPROVED, SCHEDULED, RENDERING → still "in progress" from user POV
  return 'Draft'
}

// Secondary tag shown alongside Draft for formats that require user action
type SecondaryTag = 'Replicate' | 'Record' | null

function getSecondaryTag(format: string, display: DisplayStatus): SecondaryTag {
  if (display !== 'Draft') return null
  if (format === 'replicate') return 'Replicate'
  if (format === 'head_talk') return 'Record'
  return null
}

const DISPLAY_COLOR: Record<DisplayStatus, string> = {
  Draft: 'bg-gray-700/50 border-gray-600/50 text-gray-300',
  Composed: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
  Published: 'bg-green-500/15 border-green-500/30 text-green-300',
  Error: 'bg-red-500/15 border-red-500/30 text-red-400',
}

const DISPLAY_DOT: Record<DisplayStatus, string> = {
  Draft: 'bg-gray-500',
  Composed: 'bg-purple-400',
  Published: 'bg-green-400',
  Error: 'bg-red-400',
}

const TAG_COLOR: Record<NonNullable<SecondaryTag>, string> = {
  Replicate: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  Record: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
}

// ─── Format config ────────────────────────────────────────────────────────────

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
  story: 'Story',
}

// ─── Slot chip (empty PostSlot placeholder) ───────────────────────────────────

function SlotChip({ format, time }: { format: string; time: string }) {
  const FormatIcon = FORMAT_ICON[format] ?? Film
  return (
    <div className="w-full rounded p-1.5 flex flex-col gap-0.5 text-[10px] border border-dashed border-white/10 text-white/25">
      <div className="flex items-center gap-1">
        <FormatIcon size={9} className="shrink-0" />
        <span className="font-medium truncate">{FORMAT_LABEL[format] ?? format}</span>
      </div>
      <span className="text-[9px] opacity-60 pl-3">{time}</span>
      <span className="text-[9px] pl-3">Empty slot</span>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PostSlot = {
  id: string
  format: string
  status: string
  scheduledAt: string
  post: {
    id: string
    status: string
    format: string | null
    caption: string | null
    scheduledAt: string | null
    createdAt: string
    userUploadedMediaUrl: string | null
  } | null
}

type Composition = {
  id: string
  format: string
  status: string
  scheduledAt: string | null
  caption: string | null
  createdAt: string
  userUploadedMediaUrl?: string | null
  userPostedManually?: boolean
  renderedVideoUrl?: string | null
  payload?: Record<string, unknown> | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Composition detail modal ─────────────────────────────────────────────────

function CompositionModal({
  comp,
  brandId,
  onClose,
  onRefresh,
}: {
  comp: Composition
  brandId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const [actioning, setActioning] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [newDatetime, setNewDatetime] = useState(
    comp.scheduledAt ? comp.scheduledAt.slice(0, 16) : '',
  )
  const [editingCaption, setEditingCaption] = useState(false)
  const [captionDraft, setCaptionDraft] = useState(comp.caption ?? '')
  const [editingScript, setEditingScript] = useState(false)
  const [scriptDraft, setScriptDraft] = useState(
    (comp.payload as { script?: string } | null)?.script ?? '',
  )

  const FormatIcon = FORMAT_ICON[comp.format] ?? Film

  const handleConfirm = async () => {
    setActioning(true)
    try {
      const res = await fetch(`/api/compositions/${comp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SCHEDULED' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Composition scheduled for rendering.')
      onRefresh()
      onClose()
    } catch {
      toast.error('Failed to confirm')
    } finally {
      setActioning(false)
    }
  }

  const handleReschedule = async () => {
    if (!newDatetime) return
    setActioning(true)
    try {
      const res = await fetch(`/api/compositions/${comp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: new Date(newDatetime).toISOString() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Rescheduled.')
      setRescheduling(false)
      onRefresh()
      onClose()
    } catch {
      toast.error('Failed to reschedule')
    } finally {
      setActioning(false)
    }
  }

  const handleMarkPosted = async () => {
    setActioning(true)
    try {
      const res = await fetch(`/api/compositions/${comp.id}/mark-posted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
      toast.success('Marked as manually posted.')
      onRefresh()
      onClose()
    } catch {
      toast.error('Failed')
    } finally {
      setActioning(false)
    }
  }

  const handleSaveCaption = async () => {
    setActioning(true)
    try {
      const res = await fetch(`/api/compositions/${comp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: captionDraft }),
      })
      if (!res.ok) throw new Error()
      toast.success('Caption updated.')
      setEditingCaption(false)
      onRefresh()
    } catch {
      toast.error('Failed to save caption')
    } finally {
      setActioning(false)
    }
  }

  const handleSaveScript = async () => {
    setActioning(true)
    try {
      const newPayload = { ...(comp.payload ?? {}), script: scriptDraft }
      const res = await fetch(`/api/compositions/${comp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: newPayload }),
      })
      if (!res.ok) throw new Error()
      toast.success('Script updated.')
      setEditingScript(false)
      onRefresh()
    } catch {
      toast.error('Failed to save script')
    } finally {
      setActioning(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-panel border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/5">
              <FormatIcon size={18} className="text-accent" />
            </div>
            <div>
              <p className="font-semibold">{FORMAT_LABEL[comp.format] ?? comp.format}</p>
              <p className="text-xs text-text-secondary">
                Created {new Date(comp.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(() => {
              const display = getDisplayStatus(comp.status)
              const tag = getSecondaryTag(comp.format, display)
              return (
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
                      DISPLAY_COLOR[display],
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', DISPLAY_DOT[display])} />
                    {display}
                  </span>
                  {tag && (
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full border',
                        TAG_COLOR[tag],
                      )}
                    >
                      {tag}
                    </span>
                  )}
                </div>
              )
            })()}
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          {/* Scheduled time */}
          <div className="flex items-start gap-3">
            <Clock size={15} className="text-text-secondary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-text-secondary uppercase tracking-wider mb-0.5">
                Scheduled for
              </p>
              <p className="text-sm text-white">
                {comp.scheduledAt ? fmtDateTime(comp.scheduledAt) : 'Not scheduled'}
              </p>
            </div>
          </div>

          {/* Rendered video — show inline player when Composed */}
          {comp.renderedVideoUrl && (
            <div className="rounded-lg overflow-hidden bg-black">
              <video
                src={comp.renderedVideoUrl}
                controls
                className="w-full max-h-72 object-contain"
              />
            </div>
          )}

          {/* Draft script editor (head_talk) */}
          {getDisplayStatus(comp.status) === 'Draft' && comp.format === 'head_talk' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-secondary uppercase tracking-wider">Script</p>
                {!editingScript && (
                  <button
                    onClick={() => setEditingScript(true)}
                    className="text-xs text-accent hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingScript ? (
                <>
                  <textarea
                    value={scriptDraft}
                    onChange={(e) => setScriptDraft(e.target.value)}
                    rows={6}
                    className="bg-gray-950 border border-gray-800 text-white rounded px-3 py-2 text-sm resize-none w-full"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingScript(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" disabled={actioning} onClick={handleSaveScript}>
                      {actioning ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </>
              ) : scriptDraft ? (
                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {scriptDraft}
                </p>
              ) : (
                <p className="text-sm text-text-secondary italic">No script yet.</p>
              )}
            </div>
          )}

          {/* Caption */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-secondary uppercase tracking-wider">Caption</p>
              {!editingCaption && (
                <button
                  onClick={() => setEditingCaption(true)}
                  className="text-xs text-accent hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            {editingCaption ? (
              <>
                <textarea
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  rows={4}
                  className="bg-gray-950 border border-gray-800 text-white rounded px-3 py-2 text-sm resize-none w-full"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditingCaption(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" disabled={actioning} onClick={handleSaveCaption}>
                    {actioning ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </>
            ) : captionDraft ? (
              <p className="text-sm text-white leading-relaxed line-clamp-4">{captionDraft}</p>
            ) : (
              <p className="text-sm text-text-secondary italic">No caption yet.</p>
            )}
          </div>

          {/* Reschedule form */}
          {rescheduling && (
            <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-text-secondary font-medium">New date & time</p>
              <input
                type="datetime-local"
                value={newDatetime}
                onChange={(e) => setNewDatetime(e.target.value)}
                className="bg-gray-950 border border-gray-800 text-white rounded px-3 py-2 text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setRescheduling(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={!newDatetime || actioning} onClick={handleReschedule}>
                  {actioning ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(() => {
          const display = getDisplayStatus(comp.status)
          const tag = getSecondaryTag(comp.format, display)
          const needsUpload = tag !== null && !comp.userUploadedMediaUrl
          return (
            <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-white/5">
              {comp.scheduledAt && !rescheduling && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRescheduling(true)}
                  className="gap-1.5"
                >
                  <Clock size={13} /> Reschedule
                </Button>
              )}
              {/* Replicate / Record: upload media → becomes Composed and will be auto-posted */}
              {needsUpload && (
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 transition-colors">
                  <AlertCircle size={13} />
                  {tag === 'Record' ? 'Upload recording' : 'Upload media'}
                  <input
                    type="file"
                    accept="video/*,image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const fd = new FormData()
                      fd.append('file', file)
                      fd.append('compositionId', comp.id)
                      fd.append('brandId', brandId)
                      const res = await fetch('/api/compositions/upload-recording', {
                        method: 'POST',
                        body: fd,
                      })
                      if (res.ok) {
                        toast.success('Media uploaded — will be posted at scheduled time.')
                        onRefresh()
                        onClose()
                      } else toast.error('Upload failed')
                    }}
                  />
                </label>
              )}
              {/* Mark as published manually (user posted it themselves) */}
              {tag !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkPosted}
                  disabled={actioning}
                  className="gap-1.5"
                >
                  {actioning ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Mark as published
                </Button>
              )}
              {display === 'Error' && (
                <Button size="sm" onClick={handleConfirm} disabled={actioning} className="gap-1.5">
                  {actioning ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  Retry
                </Button>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ─── Mini composition card (inside calendar day) ──────────────────────────────

function CompositionChip({ comp, onClick }: { comp: Composition; onClick: () => void }) {
  const FormatIcon = FORMAT_ICON[comp.format] ?? Film
  const display = getDisplayStatus(comp.status)
  const tag = getSecondaryTag(comp.format, display)
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded p-1.5 flex flex-col gap-0.5 text-[10px] border transition-opacity hover:opacity-80',
        DISPLAY_COLOR[display],
      )}
    >
      <div className="flex items-center gap-1">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DISPLAY_DOT[display])} />
        <FormatIcon size={9} className="shrink-0" />
        <span className="font-bold truncate">{FORMAT_LABEL[comp.format] ?? comp.format}</span>
      </div>
      {comp.scheduledAt && (
        <span className="text-[9px] opacity-60 pl-3">{fmtTime(comp.scheduledAt)}</span>
      )}
      <div className="flex items-center gap-1 pl-3">
        <span className="text-[9px] opacity-70">{display}</span>
        {tag && (
          <span className={cn('text-[8px] font-bold px-1 rounded border', TAG_COLOR[tag])}>
            {tag}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AccountCalendar({ brandId }: { brandId: string }) {
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [slots, setSlots] = useState<PostSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selected, setSelected] = useState<Composition | null>(null)

  const fetchCompositions = useCallback(async () => {
    try {
      const [compRes, slotRes] = await Promise.all([
        fetch(`/api/compositions?brandId=${brandId}`),
        fetch(`/api/brands/${brandId}/slots`),
      ])
      const compData = await compRes.json()
      const slotData = await slotRes.json()
      setCompositions(compData.compositions || [])
      setSlots(slotData.slots || [])
    } catch {
      toast.error('Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    fetchCompositions()
  }, [fetchCompositions])

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()

  const forDay = (day: Date) =>
    compositions
      .filter((c) => c.scheduledAt && isSameDay(new Date(c.scheduledAt), day))
      .sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1))

  const emptySlotsForDay = (day: Date) =>
    slots.filter((s) => s.status === 'empty' && isSameDay(new Date(s.scheduledAt), day))

  const unscheduled = compositions.filter((c) => !c.scheduledAt)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-heading font-semibold">Content Calendar</h3>
          <p className="text-xs text-text-secondary">
            Click any composition to view details or take action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="text-xs"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="px-2"
          >
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="px-2"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-4">
        {(Object.entries(DISPLAY_DOT) as [DisplayStatus, string][]).map(([status, dot]) => (
          <span key={status} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className={cn('w-2 h-2 rounded-full', dot)} />
            {status}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Replicate / Record
        </span>
      </div>

      {/* Weekly grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-secondary">
          <Loader2 className="animate-spin w-5 h-5 mr-2" />
          Loading...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 min-h-[480px]">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today)
            const dayComps = forDay(day)
            const dayEmptySlots = emptySlotsForDay(day)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'flex flex-col gap-1 rounded-lg p-2 border',
                  isToday ? 'border-accent/50 bg-accent/5' : 'border-white/5 bg-white/2',
                )}
              >
                <div className="text-center mb-1">
                  <p className="text-[10px] text-text-secondary uppercase tracking-widest">
                    {DAY_LABELS[day.getDay()]}
                  </p>
                  <p className={cn('text-sm font-bold', isToday ? 'text-accent' : 'text-white')}>
                    {day.getDate()}
                  </p>
                </div>

                {dayComps.length === 0 && dayEmptySlots.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-[10px] text-gray-700">—</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {dayComps.map((comp) => (
                      <CompositionChip
                        key={comp.id}
                        comp={comp}
                        onClick={() => setSelected(comp)}
                      />
                    ))}
                    {dayEmptySlots.map((slot) => (
                      <SlotChip key={slot.id} format={slot.format} time={fmtTime(slot.scheduledAt)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Unscheduled compositions */}
      {!loading && unscheduled.length > 0 && (
        <div>
          <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mb-3">
            Unscheduled
          </p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((comp) => {
              const FormatIcon = FORMAT_ICON[comp.format] ?? Film
              const display = getDisplayStatus(comp.status)
              const tag = getSecondaryTag(comp.format, display)
              return (
                <button
                  key={comp.id}
                  onClick={() => setSelected(comp)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-xs border transition-opacity hover:opacity-80',
                    DISPLAY_COLOR[display],
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DISPLAY_DOT[display])} />
                  <FormatIcon size={12} />
                  <span>{FORMAT_LABEL[comp.format] ?? comp.format}</span>
                  <span className="opacity-60">{display}</span>
                  {tag && (
                    <span
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                        TAG_COLOR[tag],
                      )}
                    >
                      {tag}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <CompositionModal
          comp={selected}
          brandId={brandId}
          onClose={() => setSelected(null)}
          onRefresh={fetchCompositions}
        />
      )}
    </div>
  )
}
