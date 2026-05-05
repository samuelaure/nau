'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Loader2, X, Film, Mic, Play,
  LayoutGrid, ImageIcon, Clock, Layers, Volume2, VolumeX,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import { cn } from '@/modules/shared/utils'

const FORMAT_ICON: Record<string, React.ElementType> = {
  reel: Film,
  trial_reel: Play,
  head_talk: Mic,
  carousel: LayoutGrid,
  static_post: ImageIcon,
}

const FORMAT_COLOR: Record<string, string> = {
  reel: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  trial_reel: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  head_talk: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  carousel: 'bg-pink-500/15 text-pink-300 border-pink-500/20',
  static_post: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
}

type SlotDef = { key: string; label: string; intention: string; minWords?: number; maxWords: number; style: string }

type SlotOverrides = Record<string, { intention?: string; minWords?: number; maxWords?: number }>

type Template = {
  id: string
  name: string
  format: string
  description?: string | null
  previewUrl?: string | null
  previewThumbnailUrl?: string | null
  slotSchema?: SlotDef[] | null
  contentSchema?: Record<string, unknown> | null
  brandConfigs?: Array<{
    enabled: boolean
    autoApproveDraft: boolean
    autoApprovePost: boolean
    customPrompt?: string | null
    slotOverrides?: SlotOverrides | null
  }> | null
}

// ─── Card preview — thumbnail by default, video on hover ─────────────────────

function PreviewMedia({
  previewUrl,
  previewThumbnailUrl,
  format,
  className,
}: {
  previewUrl?: string | null
  previewThumbnailUrl?: string | null
  format: string
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovering, setHovering] = useState(false)
  const FormatIcon = FORMAT_ICON[format] ?? Film

  if (!previewUrl && !previewThumbnailUrl) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <FormatIcon size={28} className="text-gray-700" />
      </div>
    )
  }

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onMouseEnter={() => {
        setHovering(true)
        videoRef.current?.play().catch(() => {})
      }}
      onMouseLeave={() => {
        setHovering(false)
        if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0 }
      }}
    >
      {/* Static thumbnail — shown when not hovering */}
      {previewThumbnailUrl && (
        <img
          src={previewThumbnailUrl}
          alt=""
          className={cn('absolute inset-0 w-full h-full object-cover transition-opacity duration-200', hovering ? 'opacity-0' : 'opacity-100')}
        />
      )}
      {/* Video — loaded lazily, shown on hover */}
      {previewUrl && (
        <video
          ref={videoRef}
          src={previewUrl}
          poster={previewThumbnailUrl ?? undefined}
          muted
          loop
          playsInline
          preload="none"
          className={cn('w-full h-full object-cover transition-opacity duration-200', hovering ? 'opacity-100' : 'opacity-0')}
        />
      )}
      {/* Fallback icon when only previewUrl (no thumbnail) and not hovering */}
      {!previewThumbnailUrl && previewUrl && !hovering && (
        <div className="absolute inset-0 flex items-center justify-center">
          <FormatIcon size={28} className="text-gray-700" />
        </div>
      )}
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

// ─── Inline slot override editor ─────────────────────────────────────────────

function SlotOverrideRow({
  slot,
  override,
  onChange,
  onRestore,
}: {
  slot: SlotDef
  override: { intention?: string; minWords?: number; maxWords?: number } | undefined
  onChange: (key: string, patch: { intention?: string; minWords?: number; maxWords?: number } | null) => void
  onRestore: (key: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [localIntention, setLocalIntention] = useState(override?.intention ?? slot.intention)
  const [localMin, setLocalMin] = useState<number>(override?.minWords ?? slot.minWords ?? 0)
  const [localMax, setLocalMax] = useState<number>(override?.maxWords ?? slot.maxWords)
  const hasOverride = !!override && (override.intention !== undefined || override.minWords !== undefined || override.maxWords !== undefined)

  const effectiveIntention = override?.intention ?? slot.intention
  const effectiveMax = override?.maxWords ?? slot.maxWords

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setLocalIntention(override?.intention ?? slot.intention); setLocalMin(override?.minWords ?? slot.minWords ?? 0); setLocalMax(override?.maxWords ?? slot.maxWords); setEditing(true) }}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
        className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-1 cursor-text hover:border-gray-700 transition-colors group"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-white">{slot.label}</span>
          <div className="flex items-center gap-2">
            {hasOverride && (
              <button
                onClick={(e) => { e.stopPropagation(); onRestore(slot.key) }}
                className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
              >
                restore default
              </button>
            )}
            <span className={cn('text-[10px] shrink-0', hasOverride ? 'text-accent' : 'text-gray-600')}>max {effectiveMax}w{hasOverride ? ' ·' : ''}{hasOverride ? ' custom' : ''}</span>
          </div>
        </div>
        <p className="text-[11px] text-text-secondary leading-relaxed">{effectiveIntention}</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-accent/40 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white">{slot.label}</span>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-gray-500">min</label>
          <input
            type="number"
            value={localMin}
            min={0}
            onChange={(e) => setLocalMin(Number(e.target.value))}
            className="w-14 text-xs bg-gray-800 border border-gray-700 text-white rounded px-1.5 py-0.5 focus:outline-none focus:border-gray-500"
          />
          <label className="text-[10px] text-gray-500">max</label>
          <input
            type="number"
            value={localMax}
            min={1}
            onChange={(e) => setLocalMax(Number(e.target.value))}
            className="w-14 text-xs bg-gray-800 border border-gray-700 text-white rounded px-1.5 py-0.5 focus:outline-none focus:border-gray-500"
          />
        </div>
      </div>
      <textarea
        value={localIntention}
        onChange={(e) => setLocalIntention(e.target.value)}
        rows={3}
        className="w-full text-[11px] bg-gray-800 border border-gray-700 text-white rounded px-2 py-1.5 resize-none focus:outline-none focus:border-gray-500 leading-relaxed"
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            const patch: { intention?: string; minWords?: number; maxWords?: number } = {}
            if (localIntention !== slot.intention) patch.intention = localIntention
            if (localMin !== (slot.minWords ?? 0)) patch.minWords = localMin
            if (localMax !== slot.maxWords) patch.maxWords = localMax
            onChange(slot.key, Object.keys(patch).length > 0 ? patch : null)
            setEditing(false)
          }}
          className="text-xs bg-white text-black rounded px-3 py-1 hover:bg-zinc-200 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function TemplateModal({
  template,
  brandId,
  onClose,
  onRefresh,
}: {
  template: Template
  brandId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const config = template.brandConfigs?.[0]
  const [isEnabled, setIsEnabled] = useState(config?.enabled ?? false)
  const [autoApproveDraft, setAutoApproveDraft] = useState(config?.autoApproveDraft ?? false)
  const [autoApprovePost, setAutoApprovePost] = useState(config?.autoApprovePost ?? false)
  const [customPrompt, setCustomPrompt] = useState(config?.customPrompt ?? '')
  const [slotOverrides, setSlotOverrides] = useState<SlotOverrides>(config?.slotOverrides ?? {})
  const [saving, setSaving] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  const FormatIcon = FORMAT_ICON[template.format] ?? Film
  const slotSchema = template.slotSchema as SlotDef[] | null
  const contentSchema = template.contentSchema as Record<string, unknown> | null

  const durationLabel = (() => {
    const dur = contentSchema?.targetDurationSeconds as string | undefined
    if (dur) return `${dur}s`
    if (slotSchema && template.format === 'reel') {
      const totalWords = slotSchema.reduce((s, sl) => s + sl.maxWords, 0)
      return `~${Math.round(totalWords * 0.4 + slotSchema.length * 2)}s`
    }
    return null
  })()

  const htSections = (contentSchema?.sections as Array<{ key: string; label: string; intention: string; maxWords: number }> | undefined) ?? null
  const sections = slotSchema ?? htSections

  const update = async (patch: { enabled?: boolean; autoApproveDraft?: boolean; autoApprovePost?: boolean }) => {
    setSaving(true)
    try {
      const res = await fetch('/api/account-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, templateId: template.id, ...patch }),
      })
      if (!res.ok) throw new Error()
      if (patch.enabled !== undefined) setIsEnabled(patch.enabled)
      if (patch.autoApproveDraft !== undefined) setAutoApproveDraft(patch.autoApproveDraft)
      if (patch.autoApprovePost !== undefined) setAutoApprovePost(patch.autoApprovePost)
      toast.success('Updated')
      onRefresh()
    } catch {
      toast.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const saveCustomizations = async (newOverrides?: SlotOverrides, newPrompt?: string) => {
    const overridesToSave = newOverrides ?? slotOverrides
    const promptToSave = newPrompt ?? customPrompt
    setSavingPrompt(true)
    try {
      const res = await fetch('/api/account-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          templateId: template.id,
          customPrompt: promptToSave || null,
          slotOverrides: Object.keys(overridesToSave).length > 0 ? overridesToSave : null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Saved')
      onRefresh()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleSlotChange = (key: string, patch: { intention?: string; minWords?: number; maxWords?: number } | null) => {
    const next = { ...slotOverrides }
    if (patch === null) { delete next[key] } else { next[key] = { ...next[key], ...patch } }
    setSlotOverrides(next)
    saveCustomizations(next)
  }

  const handleSlotRestore = (key: string) => {
    const next = { ...slotOverrides }
    delete next[key]
    setSlotOverrides(next)
    saveCustomizations(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-gray-950 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: video/thumbnail preview */}
        <div className="sm:w-52 shrink-0 bg-gray-950 flex items-stretch relative sm:rounded-l-xl overflow-hidden min-h-[200px]">
          {template.previewUrl ? (
            <>
              <video
                ref={videoRef}
                src={template.previewUrl}
                poster={template.previewThumbnailUrl ?? undefined}
                autoPlay
                loop
                muted={muted}
                playsInline
                className="w-full object-cover"
              />
              <button
                onClick={() => setMuted((m) => !m)}
                className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 text-white/70 hover:text-white transition-colors"
              >
                {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            </>
          ) : template.previewThumbnailUrl ? (
            <img src={template.previewThumbnailUrl} alt="" className="w-full object-cover" />
          ) : (
            <div className="w-full flex items-center justify-center">
              <FormatIcon size={32} className="text-gray-700" />
            </div>
          )}
        </div>

        {/* Right: info + settings */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn('p-1.5 rounded-md border', FORMAT_COLOR[template.format] ?? 'bg-white/5 text-white/50 border-gray-800')}>
                <FormatIcon size={14} />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-sm leading-tight">{template.name}</h2>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border mt-0.5 inline-block', FORMAT_COLOR[template.format] ?? 'bg-white/5 text-white/40 border-gray-800')}>
                  {template.format.replace('_', ' ')}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors shrink-0 mt-0.5">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Description */}
            {template.description && (
              <p className="text-sm text-text-secondary leading-relaxed">{template.description}</p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-2">
              {durationLabel && (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-gray-900 rounded px-2.5 py-1.5 border border-gray-800">
                  <Clock size={11} />
                  {durationLabel}
                </div>
              )}
              {sections && sections.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-gray-900 rounded px-2.5 py-1.5 border border-gray-800">
                  <Layers size={11} />
                  {sections.length} {slotSchema ? 'text slot' : 'section'}{sections.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Slot overrides — only for slot-based templates */}
            {slotSchema && slotSchema.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">What the AI fills in</p>
                <p className="text-[11px] text-gray-600">Click a slot to customize its instructions for this brand.</p>
                <div className="space-y-2">
                  {slotSchema.map((s) => (
                    <SlotOverrideRow
                      key={s.key}
                      slot={s}
                      override={slotOverrides[s.key]}
                      onChange={handleSlotChange}
                      onRestore={handleSlotRestore}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Read-only head-talk / content schema sections */}
            {!slotSchema && htSections && htSections.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Script structure</p>
                <div className="space-y-2">
                  {htSections.map((s) => (
                    <div key={s.key} className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">{s.label}</span>
                        <span className="text-[10px] text-gray-600 shrink-0">max {s.maxWords}w</span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">{s.intention}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom prompt */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Custom prompt</p>
              <p className="text-[11px] text-gray-600">Extra instructions the AI must follow when drafting for this brand with this template. Highest priority — overrides everything else.</p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Always start the hook with a number. Never use questions."
                rows={4}
                className="w-full text-sm bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-gray-600 placeholder:text-gray-600 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => saveCustomizations(undefined, customPrompt)}
                  disabled={savingPrompt}
                  className="text-xs bg-white text-black rounded px-3 py-1.5 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                >
                  {savingPrompt ? 'Saving…' : 'Save prompt'}
                </button>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Settings</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Enabled</p>
                    <p className="text-xs text-text-secondary mt-0.5">Include when generating content for this brand</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    disabled={saving}
                    onChange={(e) => update({ enabled: e.target.checked })}
                    className="w-4 h-4 accent-accent shrink-0"
                  />
                </label>
                <label className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Auto-approve draft</p>
                    <p className="text-xs text-text-secondary mt-0.5">Automatically approve the generated draft and queue it for rendering</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoApproveDraft}
                    disabled={saving}
                    onChange={(e) => update({ autoApproveDraft: e.target.checked })}
                    className="w-4 h-4 accent-accent shrink-0"
                  />
                </label>
                <label className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Auto-approve post</p>
                    <p className="text-xs text-text-secondary mt-0.5">Automatically approve the rendered video for publishing when its scheduled time arrives</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoApprovePost}
                    disabled={saving}
                    onChange={(e) => update({ autoApprovePost: e.target.checked })}
                    className="w-4 h-4 accent-accent shrink-0"
                  />
                </label>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  brandId,
  onClick,
  onToggle,
}: {
  template: Template
  brandId: string
  onClick: () => void
  onToggle: (enabled: boolean) => Promise<void>
}) {
  const config = template.brandConfigs?.[0]
  const isEnabled = config?.enabled ?? false
  const isPortrait = template.format === 'reel' || template.format === 'trial_reel'
  const [toggling, setToggling] = useState(false)

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setToggling(true)
    try {
      await onToggle(!isEnabled)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="group text-left w-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all flex flex-col cursor-pointer"
    >
      {/* Preview */}
      <div className={cn('w-full relative bg-gray-950', isPortrait ? 'aspect-[9/16]' : 'aspect-[4/3]')}>
        <PreviewMedia
          previewUrl={template.previewUrl}
          previewThumbnailUrl={template.previewThumbnailUrl}
          format={template.format}
          className="w-full h-full"
        />
        {/* Enable/disable toggle — bottom-left */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={cn(
            'absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors',
            isEnabled
              ? 'bg-green-900/80 border-green-700/50 text-green-300 hover:bg-green-800/80'
              : 'bg-gray-900/80 border-gray-700 text-gray-400 hover:bg-gray-800/80',
          )}
        >
          {toggling
            ? <Loader2 size={9} className="animate-spin" />
            : isEnabled ? <ToggleRight size={11} /> : <ToggleLeft size={11} />}
          {isEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-white transition-colors flex-1">{template.name}</p>
          <span className={cn('text-[9px] px-1 py-0.5 rounded border shrink-0', FORMAT_COLOR[template.format] ?? 'bg-gray-800 text-gray-400 border-gray-700')}>
            {template.format.replace('_', ' ')}
          </span>
        </div>
        {template.description && (
          <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">{template.description}</p>
        )}
      </div>
    </div>
  )
}

// ─── Sub-section tabs ─────────────────────────────────────────────────────────

type TabId = 'enabled' | 'disabled' | 'gallery'

const TABS: { id: TabId; label: string }[] = [
  { id: 'enabled', label: 'Enabled' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'gallery', label: 'Gallery' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AccountTemplates({ brandId }: { brandId: string }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Template | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('enabled')

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`/api/account-templates?brandId=${brandId}`)
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTemplates() }, [brandId])

  const toggleTemplate = async (templateId: string, enabled: boolean) => {
    await fetch('/api/account-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, templateId, enabled }),
    })
    await fetchTemplates()
    // Keep selected in sync
    setSelected((prev) => prev?.id === templateId ? { ...prev } : prev)
  }

  if (loading) return <p className="text-text-secondary text-sm">Loading…</p>

  const enabled = templates.filter((t) => t.brandConfigs?.[0]?.enabled)
  const disabled = templates.filter((t) => !t.brandConfigs?.[0]?.enabled)

  const visibleTemplates = activeTab === 'enabled' ? enabled : activeTab === 'disabled' ? disabled : templates

  const reelTemplates = visibleTemplates.filter((t) => t.format === 'reel' || t.format === 'trial_reel')
  const headTalkTemplates = visibleTemplates.filter((t) => t.format === 'head_talk')
  const otherTemplates = visibleTemplates.filter((t) => t.format !== 'reel' && t.format !== 'trial_reel' && t.format !== 'head_talk')

  const groups = [
    { label: 'Reels', items: reelTemplates, cols: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' },
    { label: 'Head Talk', items: headTalkTemplates, cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' },
    ...(otherTemplates.length > 0 ? [{ label: 'Other', items: otherTemplates, cols: 'grid-cols-2 sm:grid-cols-3' }] : []),
  ].filter((g) => g.items.length > 0)

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-xl font-heading font-semibold">Templates</h2>
        <p className="text-text-secondary text-sm mt-1">
          Enable templates for this brand and configure how each is used.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800">
        {TABS.map((tab) => {
          const count = tab.id === 'enabled' ? enabled.length : tab.id === 'disabled' ? disabled.length : templates.length
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-accent text-white'
                  : 'border-transparent text-text-secondary hover:text-white',
              )}
            >
              {tab.label}
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', activeTab === tab.id ? 'bg-accent/20 text-accent' : 'bg-gray-800 text-gray-500')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {templates.length === 0 ? (
        <p className="text-text-secondary text-sm">No templates available yet.</p>
      ) : visibleTemplates.length === 0 ? (
        <p className="text-text-secondary text-sm py-4">
          {activeTab === 'enabled' ? 'No templates enabled yet. Enable some from the Gallery tab.' : 'All templates are enabled.'}
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.label} className="space-y-3">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">{group.label}</h3>
              <div className={cn('grid gap-3', group.cols)}>
                {group.items.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    brandId={brandId}
                    onClick={() => setSelected(t)}
                    onToggle={(enabled) => toggleTemplate(t.id, enabled)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <TemplateModal
          template={selected}
          brandId={brandId}
          onClose={() => setSelected(null)}
          onRefresh={() => {
            fetchTemplates()
            setSelected((prev) => prev ? { ...prev } : null)
          }}
        />
      )}
    </div>
  )
}
