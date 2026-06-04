'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Loader2,
  X,
  Film,
  Mic,
  Play,
  Pencil,
  Copy,
  LayoutGrid,
  ImageIcon,
  Clock,
  Layers,
  Volume2,
  VolumeX,
  ToggleLeft,
  ToggleRight,
  Sliders,
} from 'lucide-react'
import { cn } from '@/modules/shared/utils'
import { PromptHistoryPanel } from './PromptHistoryPanel'
import { ReelSceneBuilder } from './ReelSceneBuilder'
import AddTemplateButton from '@/modules/video/components/AddTemplateButton'
import type { SceneDef } from '@/types/template-scenes'

type BrandIdentity = {
  primaryColor?: string
  secondaryColor?: string
  titleFont?: string
  bodyFont?: string
  overlayOpacity?: number
  maxTextSize?: number
}

const FORMAT_ICON: Record<string, React.ElementType> = {
  reel: Film,
  trial_reel: Play,
  head_talk: Mic,
  trial_head_talk: Play,
  carousel: LayoutGrid,
  static_post: ImageIcon,
}

const FORMAT_COLOR: Record<string, string> = {
  reel: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  trial_reel: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  head_talk: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  trial_head_talk: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  carousel: 'bg-pink-500/15 text-pink-300 border-pink-500/20',
  static_post: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
}

type SlotDef = {
  key: string
  label: string
  intention: string
  minWords?: number
  maxWords: number
  style?: string
}

const CAPTION_SLOT: SlotDef = {
  key: 'caption',
  label: 'Caption',
  intention:
    'Instagram caption for when this video is published. 2-3 sentences, engaging, no hashtags.',
  maxWords: 60,
}

type SlotOverrides = Record<string, { intention?: string; minWords?: number; maxWords?: number }>

type Template = {
  id: string
  name: string
  format: string
  remotionId?: string | null
  description?: string | null
  previewUrl?: string | null
  previewThumbnailUrl?: string | null
  slotSchema?: SlotDef[] | null
  contentSchema?: Record<string, unknown> | null
  scenes?: SceneDef[] | null
  brandConfigs?: Array<{
    id: string
    enabled: boolean
    autoApproveDraft: boolean
    autoApprovePost: boolean
    customName?: string | null
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
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.currentTime = 0
        }
      }}
    >
      {/* Static thumbnail — shown when not hovering */}
      {previewThumbnailUrl && (
        <img
          src={previewThumbnailUrl}
          alt=""
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-200',
            hovering ? 'opacity-0' : 'opacity-100',
          )}
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
          className={cn(
            'w-full h-full object-cover transition-opacity duration-200',
            hovering ? 'opacity-100' : 'opacity-0',
          )}
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
  onChange: (
    key: string,
    patch: { intention?: string; minWords?: number; maxWords?: number } | null,
  ) => void
  onRestore: (key: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [localIntention, setLocalIntention] = useState(override?.intention ?? slot.intention)
  const [localMin, setLocalMin] = useState<number>(override?.minWords ?? slot.minWords ?? 0)
  const [localMax, setLocalMax] = useState<number>(override?.maxWords ?? slot.maxWords)
  const hasOverride =
    !!override &&
    (override.intention !== undefined ||
      override.minWords !== undefined ||
      override.maxWords !== undefined)

  const effectiveIntention = override?.intention ?? slot.intention
  const effectiveMax = override?.maxWords ?? slot.maxWords

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setLocalIntention(override?.intention ?? slot.intention)
          setLocalMin(override?.minWords ?? slot.minWords ?? 0)
          setLocalMax(override?.maxWords ?? slot.maxWords)
          setEditing(true)
        }}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
        className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-1 cursor-text hover:border-gray-700 transition-colors group"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-white">{slot.label}</span>
          <div className="flex items-center gap-2">
            {hasOverride && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRestore(slot.key)
                }}
                className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
              >
                restore default
              </button>
            )}
            <span
              className={cn('text-[10px] shrink-0', hasOverride ? 'text-accent' : 'text-gray-600')}
            >
              max {effectiveMax}w{hasOverride ? ' ·' : ''}
              {hasOverride ? ' custom' : ''}
            </span>
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
  brandIdentity,
  onClose,
  onRefresh,
  onDuplicated,
}: {
  template: Template
  brandId: string
  brandIdentity?: BrandIdentity | null
  onClose: () => void
  onRefresh: () => void
  onDuplicated: (newTemplate: Template) => void
}) {
  const config = template.brandConfigs?.[0]
  const [isEnabled, setIsEnabled] = useState(config?.enabled ?? false)
  const [autoApproveDraft, setAutoApproveDraft] = useState(config?.autoApproveDraft ?? false)
  const [autoApprovePost, setAutoApprovePost] = useState(config?.autoApprovePost ?? false)
  const [customName, setCustomName] = useState(config?.customName ?? '')
  const [editingName, setEditingName] = useState(false)
  const [customPrompt, setCustomPrompt] = useState(config?.customPrompt ?? '')
  const [slotOverrides, setSlotOverrides] = useState<SlotOverrides>(config?.slotOverrides ?? {})
  const [saving, setSaving] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savingDescription, setSavingDescription] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [muted, setMuted] = useState(true)
  const [editingDescription, setEditingDescription] = useState(false)
  const [localDescription, setLocalDescription] = useState(template.description ?? '')
  const videoRef = useRef<HTMLVideoElement>(null)

  const FormatIcon = FORMAT_ICON[template.format] ?? Film
  const slotSchema = template.slotSchema as SlotDef[] | null
  const contentSchema = template.contentSchema as Record<string, unknown> | null
  const scenes = (template.scenes ?? null) as SceneDef[] | null
  const isReelFormat = template.format === 'reel' || template.format === 'trial_reel'
  const isHeadTalkFormat = template.format === 'head_talk' || template.format === 'trial_head_talk'
  
  const isDynamicReel = isReelFormat

  // Head Talk custom script/caption prompts — stored in BrandTemplateConfig.customPrompt
  // Format: "SCRIPT_PROMPT: ...\nCAPTION_PROMPT: ..."
  const parseHeadTalkPrompts = (raw: string | null | undefined) => {
    if (!raw) return { scriptPrompt: '', captionPrompt: '' }
    const scriptMatch = raw.match(/SCRIPT_PROMPT:\s*([\s\S]*?)(?=\nCAPTION_PROMPT:|$)/)
    const captionMatch = raw.match(/CAPTION_PROMPT:\s*([\s\S]*)$/)
    return {
      scriptPrompt: scriptMatch?.[1]?.trim() ?? '',
      captionPrompt: captionMatch?.[1]?.trim() ?? '',
    }
  }
  const htParsed = parseHeadTalkPrompts(config?.customPrompt)
  const [htScriptPrompt, setHtScriptPrompt] = useState(htParsed.scriptPrompt)
  const [htCaptionPrompt, setHtCaptionPrompt] = useState(htParsed.captionPrompt)
  const [savingHtPrompts, setSavingHtPrompts] = useState(false)

  const [activeTab, setActiveTab] = useState<'settings' | 'builder'>(
    isDynamicReel ? 'builder' : 'settings',
  )
  const [savingScenes, setSavingScenes] = useState(false)
  const [savingFormat, setSavingFormat] = useState(false)

  const durationLabel = (() => {
    const dur = contentSchema?.targetDurationSeconds as string | undefined
    if (dur) return `${dur}s`
    if (slotSchema && template.format === 'reel') {
      const totalWords = slotSchema.reduce((s, sl) => s + sl.maxWords, 0)
      return `~${Math.round(totalWords * 0.4 + slotSchema.length * 2)}s`
    }
    return null
  })()

  const htSections =
    (contentSchema?.sections as
      | Array<{ key: string; label: string; intention: string; maxWords: number }>
      | undefined) ?? null
  const sections = slotSchema ?? htSections

  const update = async (patch: {
    enabled?: boolean
    autoApproveDraft?: boolean
    autoApprovePost?: boolean
  }) => {
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

  const saveCustomName = async () => {
    setSavingName(true)
    try {
      const res = await fetch('/api/account-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, templateId: template.id, customName: customName || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Name saved')
      setEditingName(false)
      onRefresh()
    } catch {
      toast.error('Failed to save name')
    } finally {
      setSavingName(false)
    }
  }

  const saveDescription = async () => {
    setSavingDescription(true)
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: localDescription || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Description saved')
      setEditingDescription(false)
      onRefresh()
    } catch {
      toast.error('Failed to save description')
    } finally {
      setSavingDescription(false)
    }
  }

  const saveHtPrompts = async () => {
    setSavingHtPrompts(true)
    try {
      const composed = [
        htScriptPrompt ? `SCRIPT_PROMPT: ${htScriptPrompt}` : '',
        htCaptionPrompt ? `CAPTION_PROMPT: ${htCaptionPrompt}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      const res = await fetch('/api/account-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, templateId: template.id, customPrompt: composed || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Saved')
      onRefresh()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSavingHtPrompts(false)
    }
  }

  const duplicate = async () => {
    setDuplicating(true)
    try {
      const res = await fetch('/api/account-templates/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, templateId: template.id }),
      })
      if (!res.ok) throw new Error()
      const { template: newTemplate } = (await res.json()) as { template: Template }
      await onRefresh()
      onDuplicated(newTemplate)
    } catch {
      toast.error('Failed to duplicate template')
    } finally {
      setDuplicating(false)
    }
  }

  const handleSlotChange = (
    key: string,
    patch: { intention?: string; minWords?: number; maxWords?: number } | null,
  ) => {
    const next = { ...slotOverrides }
    if (patch === null) {
      delete next[key]
    } else {
      next[key] = { ...next[key], ...patch }
    }
    setSlotOverrides(next)
    saveCustomizations(next)
  }

  const handleSlotRestore = (key: string) => {
    const next = { ...slotOverrides }
    delete next[key]
    setSlotOverrides(next)
    saveCustomizations(next)
  }

  const saveScenes = async (newScenes: SceneDef[]) => {
    setSavingScenes(true)
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: newScenes }),
      })
      if (!res.ok) throw new Error()
      toast.success('Template saved')
      onRefresh()
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSavingScenes(false)
    }
  }

  const saveFormat = async (trialOnly: boolean) => {
    setSavingFormat(true)
    try {
      const newFormat = trialOnly
        ? isHeadTalkFormat
          ? 'trial_head_talk'
          : 'trial_reel'
        : isHeadTalkFormat
          ? 'head_talk'
          : 'reel'
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: newFormat }),
      })
      if (!res.ok) throw new Error()
      toast.success(trialOnly ? 'Marked as Trial only' : 'Marked as Standard')
      onRefresh()
    } catch {
      toast.error('Failed to update template type')
    } finally {
      setSavingFormat(false)
    }
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
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  'p-1.5 rounded-md border',
                  FORMAT_COLOR[template.format] ?? 'bg-white/5 text-white/50 border-gray-800',
                )}
              >
                <FormatIcon size={14} />
              </div>
              <div className="min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveCustomName()
                        if (e.key === 'Escape') setEditingName(false)
                      }}
                      placeholder={template.name}
                      className="text-sm font-semibold bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-white focus:outline-none focus:border-gray-400 w-40"
                    />
                    <button
                      onClick={saveCustomName}
                      disabled={savingName}
                      className="text-[11px] text-green-400 hover:text-green-300 disabled:opacity-50"
                    >
                      {savingName ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setCustomName(config?.customName ?? '')
                        setEditingName(false)
                      }}
                      className="text-[11px] text-gray-500 hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="group flex items-center gap-1 text-left"
                  >
                    <h2 className="font-semibold text-sm leading-tight group-hover:text-white/80 transition-colors">
                      {customName || template.name}
                    </h2>
                    {customName && (
                      <span className="text-[10px] text-gray-600 group-hover:text-gray-500">
                        (custom)
                      </span>
                    )}
                    <Pencil
                      size={11}
                      className="text-gray-700 group-hover:text-gray-400 transition-colors shrink-0"
                    />
                  </button>
                )}
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border mt-0.5 inline-block',
                    FORMAT_COLOR[template.format] ?? 'bg-white/5 text-white/40 border-gray-800',
                  )}
                >
                  {template.format.replace('_', ' ')}
                </span>
              </div>
              {/* Description — inline editable */}
              {editingDescription ? (
                <div className="flex flex-col gap-1.5 mt-1">
                  <textarea
                    autoFocus
                    value={localDescription}
                    onChange={(e) => setLocalDescription(e.target.value)}
                    placeholder={`Short description of this template…`}
                    rows={3}
                    className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-text-secondary focus:outline-none focus:border-gray-400 resize-none w-full"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveDescription}
                      disabled={savingDescription}
                      className="text-[11px] text-green-400 hover:text-green-300 disabled:opacity-50"
                    >
                      {savingDescription ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setLocalDescription(template.description ?? '')
                        setEditingDescription(false)
                      }}
                      className="text-[11px] text-gray-500 hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditingDescription(true)}
                  className="group flex items-start gap-1 text-left mt-1"
                >
                  {localDescription ? (
                    <p className="text-xs text-text-secondary leading-snug group-hover:text-white/70 transition-colors">
                      {localDescription}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-700 italic group-hover:text-gray-500 transition-colors">
                      Add description…
                    </p>
                  )}
                  <Pencil size={10} className="text-gray-700 group-hover:text-gray-400 shrink-0 mt-0.5 transition-colors" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <button
                onClick={duplicate}
                disabled={duplicating}
                title="Duplicate template"
                className="text-gray-500 hover:text-white transition-colors disabled:opacity-50"
              >
                {duplicating ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
              </button>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tabs — only shown for block-based reels */}
          {isDynamicReel && (
            <div className="flex border-b border-gray-800 px-5">
              {(['builder', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 -mb-px text-xs font-medium border-b-2 transition-colors capitalize',
                    activeTab === tab
                      ? 'border-accent text-white'
                      : 'border-transparent text-gray-500 hover:text-white',
                  )}
                >
                  {tab === 'builder' ? <Sliders size={11} /> : <Layers size={11} />}
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Tab content */}
          <div className="p-5 flex-1 overflow-y-auto">
            {/* Builder tab — block-based reel */}
            {activeTab === 'builder' && isDynamicReel && (
              <ReelSceneBuilder
                scenes={scenes ?? []}
                brandId={brandId}
                brandDefaults={brandIdentity ?? null}
                onSave={saveScenes}
                saving={savingScenes}
              />
            )}

            {/* Settings tab (or legacy/head_talk defaults) */}
            {(activeTab === 'settings' || !isDynamicReel) && (
              <div className="space-y-5">
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
                      {sections.length} {slotSchema ? 'text slot' : 'section'}
                      {sections.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Slot / section overrides — only for non-head-talk formats */}
                {!isHeadTalkFormat && ((slotSchema && slotSchema.length > 0) || (htSections && htSections.length > 0)) && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                      {slotSchema ? 'What the AI fills in' : 'Script sections'}
                    </p>
                    <p className="text-[11px] text-gray-600">
                      Click a section to customize its instructions for this brand.
                    </p>
                    <div className="space-y-2">
                      {(slotSchema ?? htSections!).map((s) => (
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

                {/* Head Talk: script + caption prompt textareas */}
                {isHeadTalkFormat && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Script prompt</p>
                      <p className="text-[11px] text-gray-600 mt-0.5 mb-2">
                        Holistic instructions for how the AI should write the full script for this brand.
                      </p>
                      <textarea
                        value={htScriptPrompt}
                        onChange={(e) => setHtScriptPrompt(e.target.value)}
                        placeholder={`e.g. "Write in a warm, direct tone. Open with a personal story. Keep sentences short. No buzzwords."`}
                        className="w-full text-sm bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 resize-y min-h-[100px] focus:outline-none focus:border-gray-600 placeholder:text-gray-600 leading-relaxed"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Caption prompt</p>
                      <p className="text-[11px] text-gray-600 mt-0.5 mb-2">
                        Instructions for how the AI should write the Instagram caption for this brand.
                      </p>
                      <textarea
                        value={htCaptionPrompt}
                        onChange={(e) => setHtCaptionPrompt(e.target.value)}
                        placeholder={`e.g. "2-3 sentences. End with a question to drive comments. No hashtags in caption."`}
                        className="w-full text-sm bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 resize-y min-h-[80px] focus:outline-none focus:border-gray-600 placeholder:text-gray-600 leading-relaxed"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={saveHtPrompts}
                        disabled={savingHtPrompts}
                        className="text-xs bg-white text-black rounded px-3 py-1.5 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                      >
                        {savingHtPrompts ? 'Saving…' : 'Save prompts'}
                      </button>
                    </div>
                    {config?.id && (
                      <PromptHistoryPanel
                        entityType="brand_account_template"
                        entityId={config.id}
                        field="customPrompt"
                        onRestore={(content) => {
                          const p = parseHeadTalkPrompts(content)
                          setHtScriptPrompt(p.scriptPrompt)
                          setHtCaptionPrompt(p.captionPrompt)
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Caption customization */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Caption</p>
                  <p className="text-[11px] text-gray-600">
                    Customize how the AI writes the Instagram caption for this brand.
                  </p>
                  <SlotOverrideRow
                    slot={CAPTION_SLOT}
                    override={slotOverrides['caption']}
                    onChange={handleSlotChange}
                    onRestore={handleSlotRestore}
                  />
                </div>

                {/* Custom prompt */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                    Custom prompt
                  </p>
                  <p className="text-[11px] text-gray-600">
                    Extra instructions the AI must follow when drafting for this brand with this
                    template. Highest priority — overrides everything else.
                  </p>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={
                      "How should the AI write when using this template for this brand?\n\n• Hook rule: e.g. 'Always open with a bold, specific claim — no questions'\n• Format constraint: e.g. 'Keep sentences under 12 words; no bullet lists'\n• Tone note: e.g. 'Dry and direct — no hype, no exclamation marks'\n• Brand-specific detail: e.g. 'Reference our founding year 2019 when relevant'\n• Hard restriction: e.g. 'Never mention competitors by name'"
                    }
                    className="w-full text-sm bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 resize-y min-h-[140px] focus:outline-none focus:border-gray-600 placeholder:text-gray-600 leading-relaxed"
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
                  {config?.id && (
                    <PromptHistoryPanel
                      entityType="brand_account_template"
                      entityId={config.id}
                      field="customPrompt"
                      onRestore={(content) => setCustomPrompt(content)}
                    />
                  )}
                </div>

                {/* Settings */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Settings</p>
                  <div className="flex flex-col gap-2">
                    {/* Trial only — reel/head_talk templates */}
                    {(isReelFormat || isHeadTalkFormat) && (
                      <label className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 cursor-pointer">
                        <div>
                          <p className="text-sm font-medium">Trial only</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            Only selected when a Trial {isHeadTalkFormat ? 'Head Talk' : 'Reel'} is created
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={template.format === 'trial_reel' || template.format === 'trial_head_talk'}
                          disabled={savingFormat}
                          onChange={(e) => saveFormat(e.target.checked)}
                          className="w-4 h-4 accent-accent shrink-0"
                        />
                      </label>
                    )}
                    <label className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 cursor-pointer">
                      <div>
                        <p className="text-sm font-medium">Enabled</p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          Include when generating content for this brand
                        </p>
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
                        <p className="text-xs text-text-secondary mt-0.5">
                          Automatically approve the generated draft and queue it for rendering
                        </p>
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
                        <p className="text-xs text-text-secondary mt-0.5">
                          Automatically approve the rendered video for publishing when its scheduled
                          time arrives
                        </p>
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
            )}
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
      <div
        className={cn('w-full relative bg-gray-950', isPortrait ? 'aspect-[9/16]' : 'aspect-[4/3]')}
      >
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
          {toggling ? (
            <Loader2 size={9} className="animate-spin" />
          ) : isEnabled ? (
            <ToggleRight size={11} />
          ) : (
            <ToggleLeft size={11} />
          )}
          {isEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-white transition-colors flex-1">
            {config?.customName || template.name}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {(config?.customPrompt ||
              (config?.slotOverrides && Object.keys(config.slotOverrides).length > 0)) && (
              <span
                className="text-[9px] px-1 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20"
                title="Custom prompt set"
              >
                custom
              </span>
            )}
            <span
              className={cn(
                'text-[9px] px-1 py-0.5 rounded border',
                FORMAT_COLOR[template.format] ?? 'bg-gray-800 text-gray-400 border-gray-700',
              )}
            >
              {template.format.replace('_', ' ')}
            </span>
          </div>
        </div>
        {template.description && (
          <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">
            {template.description}
          </p>
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

export default function AccountTemplates({ brandId, brandIdentity: initialBrandIdentity }: { brandId: string; brandIdentity?: BrandIdentity | null }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [brandIdentity] = useState<BrandIdentity | null>(initialBrandIdentity ?? null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Template | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('enabled')

  const fetchTemplates = async (): Promise<Template[]> => {
    try {
      const res = await fetch(`/api/account-templates?brandId=${brandId}`)
      const data = await res.json()
      const fetched: Template[] = data.templates || []
      setTemplates(fetched)
      return fetched
    } catch {
      toast.error('Failed to load templates')
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [brandId])

  const toggleTemplate = async (templateId: string, enabled: boolean) => {
    await fetch('/api/account-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, templateId, enabled }),
    })
    await fetchTemplates()
    // Keep selected in sync
    setSelected((prev) => (prev?.id === templateId ? { ...prev } : prev))
  }

  if (loading) return <p className="text-text-secondary text-sm">Loading…</p>

  const enabled = templates.filter((t) => t.brandConfigs?.[0]?.enabled)
  const disabled = templates.filter((t) => !t.brandConfigs?.[0]?.enabled)

  const visibleTemplates =
    activeTab === 'enabled' ? enabled : activeTab === 'disabled' ? disabled : templates

  const reelTemplates = visibleTemplates.filter(
    (t) => t.format === 'reel' || t.format === 'trial_reel',
  )
  const headTalkTemplates = visibleTemplates.filter(
    (t) => t.format === 'head_talk' || t.format === 'trial_head_talk',
  )
  const otherTemplates = visibleTemplates.filter(
    (t) =>
      t.format !== 'reel' &&
      t.format !== 'trial_reel' &&
      t.format !== 'head_talk' &&
      t.format !== 'trial_head_talk',
  )

  const groups = [
    { label: 'Reels', items: reelTemplates, cols: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' },
    {
      label: 'Head Talk',
      items: headTalkTemplates,
      cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    },
    ...(otherTemplates.length > 0
      ? [{ label: 'Other', items: otherTemplates, cols: 'grid-cols-2 sm:grid-cols-3' }]
      : []),
  ].filter((g) => g.items.length > 0)

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-semibold">Templates</h2>
          <p className="text-text-secondary text-sm mt-1">
            Enable templates for this brand and configure how each is used.
          </p>
        </div>
        <AddTemplateButton defaultAccountId={brandId} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800">
        {TABS.map((tab) => {
          const count =
            tab.id === 'enabled'
              ? enabled.length
              : tab.id === 'disabled'
                ? disabled.length
                : templates.length
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
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  activeTab === tab.id ? 'bg-accent/20 text-accent' : 'bg-gray-800 text-gray-500',
                )}
              >
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
          {activeTab === 'enabled'
            ? 'No templates enabled yet. Enable some from the Gallery tab.'
            : 'All templates are enabled.'}
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.label} className="space-y-3">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                {group.label}
              </h3>
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
          brandIdentity={brandIdentity}
          onClose={() => setSelected(null)}
          onRefresh={async () => {
            const fresh = await fetchTemplates()
            setSelected((prev) => (prev ? (fresh.find((t) => t.id === prev.id) ?? prev) : null))
          }}
          onDuplicated={(newTemplate) => setSelected(newTemplate)}
        />
      )}
    </div>
  )
}
