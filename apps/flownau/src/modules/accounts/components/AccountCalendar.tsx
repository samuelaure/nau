'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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
  CalendarClock,
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

const DISPLAY_DOT: Record<DisplayStatus, string> = {
  Draft: 'bg-gray-400',
  Composed: 'bg-purple-400',
  Published: 'bg-green-400',
  Error: 'bg-red-400',
}

const TAG_COLOR: Record<NonNullable<SecondaryTag>, string> = {
  Replicate: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  Record: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
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

const FORMAT_COLOR: Record<string, string> = {
  reel: 'bg-blue-500/15 border-blue-500/30 text-blue-200',
  trial_reel: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-200',
  head_talk: 'bg-purple-500/15 border-purple-500/30 text-purple-200',
  carousel: 'bg-pink-500/15 border-pink-500/30 text-pink-200',
  static_post: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200',
  story: 'bg-orange-500/15 border-orange-500/30 text-orange-200',
}

// ─── Slot chip (empty PostSlot placeholder) — droppable ──────────────────────

function SlotChip({
  slot,
  dragState,
  onDrop,
}: {
  slot: PostSlot
  dragState: DragState | null
  onDrop: (slotId: string, scheduledAt: string) => void
}) {
  const FormatIcon = FORMAT_ICON[slot.format] ?? Film
  const canDrop = dragState?.format === slot.format
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={(e) => { if (canDrop) { e.preventDefault(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (canDrop) onDrop(slot.id, slot.scheduledAt) }}
      className={cn(
        'w-full rounded p-1.5 flex flex-col gap-0.5 text-[10px] border border-dashed transition-colors',
        over && canDrop
          ? 'border-accent bg-accent/10 text-accent'
          : canDrop && dragState
            ? 'border-accent/40 text-accent/50'
            : 'border-white/10 text-white/25',
      )}
    >
      <div className="flex items-center gap-1">
        <FormatIcon size={9} className="shrink-0" />
        <span className="font-medium truncate">{FORMAT_LABEL[slot.format] ?? slot.format}</span>
      </div>
      <span className="text-[9px] opacity-60 pl-3">{fmtTime(slot.scheduledAt)}</span>
      <span className="text-[9px] pl-3">{over && canDrop ? 'Drop here' : 'Empty slot'}</span>
    </div>
  )
}

// ─── Generating slot placeholder ─────────────────────────────────────────────

function GeneratingSlotChip({ slot }: { slot: PostSlot }) {
  const FormatIcon = FORMAT_ICON[slot.format] ?? Film
  return (
    <div className="w-full rounded p-1.5 flex flex-col gap-0.5 text-[10px] border border-white/15 bg-white/4 animate-pulse">
      <div className="flex items-center gap-1 text-white/40">
        <FormatIcon size={9} className="shrink-0" />
        <span className="font-medium truncate">{FORMAT_LABEL[slot.format] ?? slot.format}</span>
        <Loader2 size={8} className="ml-auto animate-spin opacity-60 shrink-0" />
      </div>
      <span className="text-[9px] opacity-40 pl-3">{fmtTime(slot.scheduledAt)}</span>
      <span className="text-[9px] pl-3 text-white/30">Generating…</span>
    </div>
  )
}

// ─── Between-slot drop zone ───────────────────────────────────────────────────

function BetweenDropZone({
  beforeTime,
  afterTime,
  dragState,
  onDrop,
}: {
  beforeTime: string | null
  afterTime: string | null
  dragState: DragState | null
  onDrop: (scheduledAt: string) => void
}) {
  const [over, setOver] = useState(false)
  if (!dragState) return null

  const midTime = beforeTime && afterTime
    ? new Date((new Date(beforeTime).getTime() + new Date(afterTime).getTime()) / 2).toISOString()
    : afterTime ?? beforeTime ?? new Date().toISOString()

  return (
    // min-h keeps the zone stable when expanded — avoids layout reflow that causes onDragLeave to fire
    <div
      onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false) }}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(midTime) }}
      className={cn(
        'w-full rounded transition-colors flex items-center justify-center',
        over
          ? 'min-h-[24px] bg-accent/20 border border-dashed border-accent'
          : 'min-h-[6px] bg-white/5 hover:bg-white/10',
      )}
    >
      {over && <span className="text-[9px] text-accent pointer-events-none">Drop here · {fmtTime(midTime)}</span>}
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
  ideaText?: string | null
  createdAt: string
  userUploadedMediaUrl?: string | null
  coverUrl?: string | null
  videoUrl?: string | null
  renderedVideoUrl?: string | null
  userPostedManually?: boolean
  payload?: Record<string, unknown> | null
}

type DragState = {
  postId: string
  format: string
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
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} ${time}`
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
                Created {new Date(comp.createdAt).toLocaleDateString('en-GB')}
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
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-gray-800/50 border-gray-700/50 text-gray-300"
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

// ─── Mini composition card (inside calendar day) — draggable ───────────────────

function CompositionChip({
  comp,
  onClick,
  dragState,
  onDragStart,
  onDragEnd,
}: {
  comp: Composition
  onClick: () => void
  dragState: DragState | null
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const FormatIcon = FORMAT_ICON[comp.format] ?? Film
  const display = getDisplayStatus(comp.status)
  const tag = getSecondaryTag(comp.format, display)
  const isDragging = dragState?.postId === comp.id
  const formatColor = FORMAT_COLOR[comp.format] ?? 'bg-gray-800/50 border-gray-700/50 text-gray-200'

  // Prioritize cover image, fallback to rendered video if available (browser can try to grab first frame), or uploaded media.
  // Actually, we shouldn't use video files as standard <img> src, but if coverUrl exists, we use it.
  const thumb = comp.coverUrl || (comp.renderedVideoUrl?.endsWith('.mp4') ? null : comp.renderedVideoUrl) || (comp.userUploadedMediaUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? comp.userUploadedMediaUrl : null)

  const isVideoThumb = !thumb && (comp.renderedVideoUrl || comp.userUploadedMediaUrl)

  return (
    <button
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'w-full text-left rounded p-1.5 flex flex-col gap-1 text-[10px] border transition-all cursor-grab active:cursor-grabbing overflow-hidden',
        isDragging ? 'opacity-40 scale-95' : 'hover:brightness-110',
        formatColor,
      )}
    >
      <div className="flex items-start justify-between w-full">
        <div className="flex items-center gap-1">
          <FormatIcon size={10} className="shrink-0" />
          <span className="font-bold truncate leading-none pt-0.5">{FORMAT_LABEL[comp.format] ?? comp.format}</span>
        </div>
        {tag && (
          <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded border leading-none', TAG_COLOR[tag])}>
            {tag}
          </span>
        )}
      </div>

      {(thumb || isVideoThumb) && (
        <div className="w-full h-14 rounded overflow-hidden bg-black/20 flex-shrink-0 relative">
          {thumb ? (
            <img src={thumb} alt="Thumbnail" className="w-full h-full object-cover opacity-90" />
          ) : isVideoThumb ? (
            <video src={comp.renderedVideoUrl || comp.userUploadedMediaUrl || ''} className="w-full h-full object-cover opacity-90" muted playsInline />
          ) : null}
        </div>
      )}

      {comp.ideaText && (
        <p className="text-[9.5px] opacity-80 leading-snug line-clamp-2 whitespace-pre-wrap">
          {comp.ideaText}
        </p>
      )}

      <div className="flex items-center justify-between w-full mt-auto pt-0.5">
        <span className="text-[9px] opacity-70 font-medium">
          {comp.scheduledAt ? fmtTime(comp.scheduledAt) : 'Unscheduled'}
        </span>
        <div className="flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DISPLAY_DOT[display])} />
          <span className="text-[9px] opacity-70">{display}</span>
        </div>
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AccountCalendar({ brandId, workspaceId }: { brandId: string; workspaceId?: string }) {
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [slots, setSlots] = useState<PostSlot[]>([])
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selected, setSelected] = useState<Composition | null>(null)
  const [runningCoverage, setRunningCoverage] = useState(false)
  const [generatingSlotIds, setGeneratingSlotIds] = useState<Set<string>>(new Set())

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

  const handleRunCoverage = async () => {
    // Immediately mark all current empty slots as generating for optimistic UI
    const emptyIds = new Set(slots.filter((s) => s.status === 'empty').map((s) => s.id))
    setGeneratingSlotIds(emptyIds)
    setRunningCoverage(true)
    const loadingId = toast.loading('Filling calendar…')
    try {
      const res = await fetch(`/api/brands/${brandId}/fill-calendar`, { method: 'POST' })
      const data = await res.json()
      toast.dismiss(loadingId)
      if (!res.ok) throw new Error(data.error ?? 'Failed')

      const r = data.result as {
        alreadyFull: boolean
        slotsNeeded: number
        ideasGenerated: number
        noDigest: boolean
        approvedIdeas: number
        slotsFilled: number
        needsApproval: number
      }

      if (r.alreadyFull) {
        toast.success('Calendar is already fully scheduled.')
        return
      }

      // Step 1: report idea generation
      if (r.ideasGenerated > 0) {
        toast.info(`Generated ${r.ideasGenerated} new idea${r.ideasGenerated === 1 ? '' : 's'} to fill the queue.`)
      } else if (r.noDigest && r.approvedIdeas < r.slotsNeeded) {
        toast.warning('Could not auto-generate ideas — no InspoBase digest available. Add topics manually in the Ideas tab.')
      }

      // Step 2: approval gap
      if (r.needsApproval > 0) {
        toast.warning(
          `To fill the calendar we need ${r.slotsNeeded} post${r.slotsNeeded === 1 ? '' : 's'}, but only ${r.approvedIdeas} idea${r.approvedIdeas === 1 ? '' : 's'} ${r.approvedIdeas === 1 ? 'is' : 'are'} approved. Approve ${r.needsApproval} more in the Ideas tab.`,
          { duration: 8000 },
        )
      }

      // Step 3: final scheduling result
      const remaining = r.slotsNeeded - r.slotsFilled
      if (r.slotsFilled === 0 && r.needsApproval > 0) {
        // All blocked on approval — main message was already shown above
      } else if (remaining > 0) {
        toast.success(
          `${r.slotsFilled} of ${r.slotsNeeded} post${r.slotsNeeded === 1 ? '' : 's'} scheduled. Approve ${remaining} more idea${remaining === 1 ? '' : 's'} and run Fill Calendar again to complete it.`,
          { duration: 8000 },
        )
      } else {
        toast.success(`Calendar filled — ${r.slotsFilled} post${r.slotsFilled === 1 ? '' : 's'} scheduled.`)
      }

      await fetchCompositions()
      setGeneratingSlotIds(new Set())
    } catch (err) {
      toast.dismiss(loadingId)
      toast.error(err instanceof Error ? err.message : 'Fill calendar failed')
      setGeneratingSlotIds(new Set())
    } finally {
      setRunningCoverage(false)
    }
  }

  const handleDrop = async (postId: string, scheduledAt: string, slotId?: string) => {
    setDragState(null)

    // Optimistic update: update the moved post's scheduledAt
    setCompositions((prev) =>
      prev.map((c) => c.id === postId ? { ...c, scheduledAt } : c),
    )

    // Optimistic slot updates
    setSlots((prev) => {
      let next = prev
      // Release the old slot this post was in (if any)
      next = next.map((s) =>
        s.post?.id === postId ? { ...s, status: 'empty', post: null } : s,
      )
      // Fill the new target slot (if dropping onto a named slot)
      if (slotId) {
        next = next.map((s) =>
          s.id === slotId ? { ...s, status: 'filled', post: null } : s,
        )
      }
      return next
    })

    try {
      await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Always send releaseSlot so the backend clears the old slot even when dropping to free space
        body: JSON.stringify({ scheduledAt, releaseSlot: true, ...(slotId ? { slotId } : {}) }),
      })
      fetchCompositions()
    } catch {
      toast.error('Failed to schedule post')
      fetchCompositions()
    }
  }

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
          {workspaceId && (
            <Link
              href={`/dashboard/workspace/${workspaceId}?brandId=${brandId}&tab=settings&settingsTab=schedule`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent/50 transition-colors whitespace-nowrap"
            >
              <CalendarClock size={13} />
              Schedule Setup
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunCoverage}
            disabled={runningCoverage}
            className="text-xs gap-1.5"
          >
            {runningCoverage ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {runningCoverage ? 'Running…' : 'Fill Calendar'}
          </Button>
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
            {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
            {addDays(weekStart, 6).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
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
                    {dragState ? (
                      <BetweenDropZone
                        beforeTime={null}
                        afterTime={`${day.toISOString().slice(0, 10)}T12:00:00.000Z`}
                        dragState={dragState}
                        onDrop={(t) => handleDrop(dragState.postId, t)}
                      />
                    ) : (
                      <span className="text-[10px] text-gray-700">—</span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {/* Merge and sort all chips by time for accurate between-drop zones */}
                    {(() => {
                      type ChipItem =
                        | { kind: 'comp'; data: Composition; time: string }
                        | { kind: 'slot'; data: PostSlot; time: string }
                      const items: ChipItem[] = [
                        ...dayComps.map(c => ({ kind: 'comp' as const, data: c, time: c.scheduledAt! })),
                        ...dayEmptySlots.map(s => ({ kind: 'slot' as const, data: s, time: s.scheduledAt })),
                      ].sort((a, b) => a.time < b.time ? -1 : 1)

                      return items.map((item, idx) => (
                        <div key={item.kind === 'comp' ? item.data.id : item.data.id}>
                          <BetweenDropZone
                            beforeTime={idx > 0 ? items[idx - 1].time : null}
                            afterTime={item.time}
                            dragState={dragState}
                            onDrop={(t) => handleDrop(dragState!.postId, t)}
                          />
                          {item.kind === 'comp' ? (
                            <CompositionChip
                              comp={item.data}
                              onClick={() => setSelected(item.data)}
                              dragState={dragState}
                              onDragStart={() => setDragState({ postId: item.data.id, format: item.data.format })}
                              onDragEnd={() => setDragState(null)}
                            />
                          ) : generatingSlotIds.has(item.data.id) ? (
                            <GeneratingSlotChip slot={item.data} />
                          ) : (
                            <SlotChip
                              slot={item.data}
                              dragState={dragState}
                              onDrop={(slotId, scheduledAt) => handleDrop(dragState!.postId, scheduledAt, slotId)}
                            />
                          )}
                          {idx === items.length - 1 && (
                            <BetweenDropZone
                              beforeTime={item.time}
                              afterTime={null}
                              dragState={dragState}
                              onDrop={(t) => handleDrop(dragState!.postId, t)}
                            />
                          )}
                        </div>
                      ))
                    })()}
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
          <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mb-1">
            Unscheduled
          </p>
          <p className="text-[11px] text-text-secondary mb-3">
            Drag any post (scheduled or unscheduled) onto a matching empty slot, or between slots to set a custom time.
          </p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((comp) => {
              const FormatIcon = FORMAT_ICON[comp.format] ?? Film
              const display = getDisplayStatus(comp.status)
              const tag = getSecondaryTag(comp.format, display)
              const formatColor = FORMAT_COLOR[comp.format] ?? 'bg-gray-800/50 border-gray-700/50 text-gray-200'
              const thumb = comp.coverUrl || (comp.renderedVideoUrl?.endsWith('.mp4') ? null : comp.renderedVideoUrl) || (comp.userUploadedMediaUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? comp.userUploadedMediaUrl : null)
              const isVideoThumb = !thumb && (comp.renderedVideoUrl || comp.userUploadedMediaUrl)
              const isDragging = dragState?.postId === comp.id

              return (
                <button
                  key={comp.id}
                  draggable
                  onDragStart={() => setDragState({ postId: comp.id, format: comp.format })}
                  onDragEnd={() => setDragState(null)}
                  onClick={() => setSelected(comp)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-lg px-3 py-2 text-xs border transition-all cursor-grab active:cursor-grabbing w-40 overflow-hidden',
                    isDragging ? 'opacity-40 scale-95' : 'hover:brightness-110',
                    formatColor,
                  )}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <FormatIcon size={12} className="shrink-0" />
                      <span className="font-bold truncate leading-none pt-0.5">{FORMAT_LABEL[comp.format] ?? comp.format}</span>
                    </div>
                    {tag && (
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none', TAG_COLOR[tag])}>
                        {tag}
                      </span>
                    )}
                  </div>

                  {(thumb || isVideoThumb) && (
                    <div className="w-full h-16 rounded overflow-hidden bg-black/20 flex-shrink-0 relative">
                      {thumb ? (
                        <img src={thumb} alt="Thumbnail" className="w-full h-full object-cover opacity-90" />
                      ) : isVideoThumb ? (
                        <video src={comp.renderedVideoUrl || comp.userUploadedMediaUrl || ''} className="w-full h-full object-cover opacity-90" muted playsInline />
                      ) : null}
                    </div>
                  )}

                  {comp.ideaText && (
                    <p className="text-[10px] opacity-80 leading-snug line-clamp-2 whitespace-pre-wrap text-left">
                      {comp.ideaText}
                    </p>
                  )}

                  <div className="flex items-center justify-between w-full mt-auto pt-1">
                    <span className="text-[10px] opacity-70 font-medium">Unscheduled</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DISPLAY_DOT[display])} />
                      <span className="text-[10px] opacity-70">{display}</span>
                    </div>
                  </div>
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
