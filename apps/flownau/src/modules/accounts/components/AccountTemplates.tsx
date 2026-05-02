'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import { SlidersHorizontal, ChevronDown, Loader2, X, Film, Mic, Play, LayoutGrid, ImageIcon, Clock, Layers, CheckCircle2, Circle, Volume2, VolumeX } from 'lucide-react'
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

type SlotDef = { key: string; label: string; intention: string; maxWords: number; style: string }

type Template = {
  id: string
  name: string
  format: string
  description?: string | null
  previewUrl?: string | null
  slotSchema?: SlotDef[] | null
  contentSchema?: Record<string, unknown> | null
  brandConfigs?: Array<{
    enabled: boolean
    autoApproveDraft: boolean
    autoApprovePost: boolean
    customPrompt?: string | null
  }> | null
}

// ─── Video preview — autoplays silently, pauses on mouse-leave ───────────────

function VideoThumb({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      onMouseEnter={() => ref.current?.play().catch(() => {})}
      onMouseLeave={() => { if (ref.current) { ref.current.pause(); ref.current.currentTime = 0 } }}
      className={className}
    />
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
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptDraft, setPromptDraft] = useState(config?.customPrompt ?? '')
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

  // Head-talk sections from contentSchema
  const htSections = (contentSchema?.sections as Array<{ key: string; label: string; intention: string; maxWords: number }> | undefined) ?? null

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

  const savePrompt = async () => {
    setSavingPrompt(true)
    try {
      const res = await fetch('/api/account-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, templateId: template.id, customPrompt: promptDraft || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Prompt saved')
      setPromptOpen(false)
      onRefresh()
    } catch {
      toast.error('Failed to save prompt')
    } finally {
      setSavingPrompt(false)
    }
  }

  const sections = slotSchema ?? htSections

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-gray-950 border border-white/10 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: video preview */}
        <div className="sm:w-52 shrink-0 bg-black flex items-stretch relative sm:rounded-l-xl overflow-hidden min-h-[200px]">
          {template.previewUrl ? (
            <>
              <video
                ref={videoRef}
                src={template.previewUrl}
                autoPlay
                loop
                muted={muted}
                playsInline
                className="w-full object-cover"
              />
              {/* Mute toggle */}
              <button
                onClick={() => setMuted((m) => !m)}
                className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 text-white/70 hover:text-white transition-colors"
              >
                {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <FormatIcon size={32} className="text-white/15" />
            </div>
          )}
        </div>

        {/* Right: info + settings */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-5 border-b border-white/8 sticky top-0 bg-gray-950 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn('p-1.5 rounded-md border', FORMAT_COLOR[template.format] ?? 'bg-white/5 text-white/50 border-white/10')}>
                <FormatIcon size={14} />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-sm leading-tight">{template.name}</h2>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border mt-0.5 inline-block', FORMAT_COLOR[template.format] ?? 'bg-white/5 text-white/40 border-white/10')}>
                  {template.format.replace('_', ' ')}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors shrink-0 mt-0.5">
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
                <div className="flex items-center gap-1.5 text-xs text-white/50 bg-white/5 rounded px-2.5 py-1.5 border border-white/8">
                  <Clock size={11} />
                  {durationLabel}
                </div>
              )}
              {sections && sections.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-white/50 bg-white/5 rounded px-2.5 py-1.5 border border-white/8">
                  <Layers size={11} />
                  {sections.length} {slotSchema ? 'text slot' : 'section'}{sections.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Content breakdown */}
            {sections && sections.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-white/40 uppercase tracking-wide">
                  {slotSchema ? 'What the AI fills in' : 'Script structure'}
                </p>
                <div className="space-y-2">
                  {sections.map((s) => (
                    <div key={s.key} className="bg-white/3 border border-white/8 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white/80">{s.label}</span>
                        <span className="text-[10px] text-white/30 shrink-0">max {s.maxWords}w</span>
                      </div>
                      <p className="text-[11px] text-white/40 leading-relaxed">{s.intention}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wide">Settings</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between bg-white/3 border border-white/8 rounded-lg px-3 py-2.5 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Enabled</p>
                    <p className="text-xs text-white/40 mt-0.5">Include when generating content for this brand</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    disabled={saving}
                    onChange={(e) => update({ enabled: e.target.checked })}
                    className="w-4 h-4 accent-accent shrink-0"
                  />
                </label>
                <label className="flex items-center justify-between bg-white/3 border border-white/8 rounded-lg px-3 py-2.5 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Auto-approve draft</p>
                    <p className="text-xs text-white/40 mt-0.5">Automatically approve the generated draft and queue it for rendering</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoApproveDraft}
                    disabled={saving}
                    onChange={(e) => update({ autoApproveDraft: e.target.checked })}
                    className="w-4 h-4 accent-accent shrink-0"
                  />
                </label>
                <label className="flex items-center justify-between bg-white/3 border border-white/8 rounded-lg px-3 py-2.5 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Auto-approve post</p>
                    <p className="text-xs text-white/40 mt-0.5">Automatically approve the rendered video for publishing when its scheduled time arrives</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoApprovePost}
                    disabled={saving}
                    onChange={(e) => update({ autoApprovePost: e.target.checked })}
                    className="w-4 h-4 accent-green-400 shrink-0"
                  />
                </label>
              </div>
            </div>

            {/* Custom prompt */}
            <div className="space-y-2">
              <button
                onClick={() => setPromptOpen((o) => !o)}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  config?.customPrompt ? 'text-amber-300 hover:text-amber-200' : 'text-white/40 hover:text-white',
                )}
              >
                <SlidersHorizontal size={11} />
                {config?.customPrompt ? 'Custom prompt set' : 'Add custom prompt'}
                <ChevronDown size={11} className={cn('transition-transform', promptOpen && 'rotate-180')} />
              </button>
              {promptOpen && (
                <div className="space-y-2">
                  <p className="text-xs text-text-secondary">
                    Instructions injected when this template is used — overrides defaults.
                  </p>
                  <textarea
                    rows={4}
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    placeholder="e.g. 'Always open with a provocative question. Keep each line under 8 words.'"
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2.5 text-xs text-white resize-none focus:outline-none focus:border-accent/50"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setPromptOpen(false)}>Cancel</Button>
                    <Button size="sm" className="text-xs bg-accent text-white" disabled={savingPrompt} onClick={savePrompt}>
                      {savingPrompt ? <Loader2 size={11} className="animate-spin mr-1" /> : null}
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onClick }: { template: Template; onClick: () => void }) {
  const config = template.brandConfigs?.[0]
  const isEnabled = config?.enabled ?? false
  const FormatIcon = FORMAT_ICON[template.format] ?? Film
  const isPortrait = template.format === 'reel' || template.format === 'trial_reel'

  return (
    <button
      onClick={onClick}
      className="group text-left w-full bg-gray-900/60 border border-white/8 rounded-xl overflow-hidden hover:border-accent/40 hover:bg-gray-900 transition-all flex flex-col"
    >
      {/* Preview */}
      <div className={cn(
        'w-full relative bg-black overflow-hidden',
        isPortrait ? 'aspect-[9/16]' : 'aspect-[4/3]',
      )}>
        {template.previewUrl ? (
          <>
            <VideoThumb src={template.previewUrl} className="w-full h-full object-cover" />
            {/* Enabled badge overlay */}
            <div className="absolute top-2 right-2">
              {isEnabled
                ? <CheckCircle2 size={16} className="text-green-400 drop-shadow" />
                : <Circle size={16} className="text-white/30 drop-shadow" />}
            </div>
          </>
        ) : (
          <>
            <div className="w-full h-full flex items-center justify-center">
              <FormatIcon size={28} className="text-white/15" />
            </div>
            <div className="absolute top-2 right-2">
              {isEnabled
                ? <CheckCircle2 size={16} className="text-green-400 drop-shadow" />
                : <Circle size={16} className="text-white/30 drop-shadow" />}
            </div>
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-white transition-colors flex-1">{template.name}</p>
          <span className={cn('text-[9px] px-1 py-0.5 rounded border shrink-0', FORMAT_COLOR[template.format] ?? 'bg-white/5 text-white/40 border-white/10')}>
            {template.format.replace('_', ' ')}
          </span>
        </div>
        {template.description && (
          <p className="text-[11px] text-white/35 leading-snug line-clamp-3">{template.description}</p>
        )}
      </div>
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AccountTemplates({ brandId }: { brandId: string }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Template | null>(null)

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

  if (loading) return <p className="text-text-secondary text-sm">Loading…</p>

  const reelTemplates = templates.filter((t) => t.format === 'reel' || t.format === 'trial_reel')
  const headTalkTemplates = templates.filter((t) => t.format === 'head_talk')
  const otherTemplates = templates.filter((t) => t.format !== 'reel' && t.format !== 'trial_reel' && t.format !== 'head_talk')

  const groups = [
    { label: 'Reels', items: reelTemplates, cols: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' },
    { label: 'Head Talk', items: headTalkTemplates, cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' },
    ...(otherTemplates.length > 0 ? [{ label: 'Other', items: otherTemplates, cols: 'grid-cols-2 sm:grid-cols-3' }] : []),
  ].filter((g) => g.items.length > 0)

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-heading font-semibold">Templates</h2>
        <p className="text-text-secondary text-sm mt-1">
          Enable templates for this brand and configure how each is used.
        </p>
      </div>

      {templates.length === 0 ? (
        <p className="text-text-secondary text-sm">No templates available yet.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.label} className="space-y-3">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide">{group.label}</h3>
              <div className={cn('grid gap-3', group.cols)}>
                {group.items.map((t) => (
                  <TemplateCard key={t.id} template={t} onClick={() => setSelected(t)} />
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
