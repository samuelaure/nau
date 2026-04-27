'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/modules/shared/components/ui/Button'
import { Card } from '@/modules/shared/components/ui/Card'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Trash2,
  Save,
  Loader2,
  Film,
  Play,
  Mic,
  LayoutGrid,
  ImageIcon,
  Hash,
  AlignLeft,
  ChevronLeft,
} from 'lucide-react'

const FORMAT_LABEL: Record<string, string> = {
  reel: 'Reel',
  trial_reel: 'Trial Reel',
  head_talk: 'Head Talk',
  carousel: 'Carousel',
  static_post: 'Static Post',
  story: 'Story',
}

const FORMAT_ICON: Record<string, React.ElementType> = {
  reel: Film,
  trial_reel: Play,
  head_talk: Mic,
  carousel: LayoutGrid,
  static_post: ImageIcon,
  story: Play,
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-orange-900/60 text-orange-400',
  APPROVED: 'bg-green-900/60 text-green-400',
  RENDERING: 'bg-blue-900/60 text-blue-400',
  RENDERED: 'bg-cyan-900/60 text-cyan-400',
  SCHEDULED: 'bg-purple-900/60 text-purple-400',
  PUBLISHING: 'bg-yellow-900/60 text-yellow-400',
  PUBLISHED: 'bg-gray-700 text-gray-400',
  FAILED: 'bg-red-900/60 text-red-400',
}

/** Slot labels per scene type */
const SLOT_META: Record<string, Array<{ key: string; label: string; maxLen: number; multiline?: boolean }>> = {
  'hook-text': [{ key: 'hook', label: 'Hook', maxLen: 80, multiline: true }],
  'text-over-media': [{ key: 'text', label: 'Text', maxLen: 150, multiline: true }],
  'quote-card': [
    { key: 'quote', label: 'Quote', maxLen: 200, multiline: true },
    { key: 'attribution', label: 'Attribution', maxLen: 50 },
  ],
  'list-reveal': [{ key: 'title', label: 'Title', maxLen: 60 }],
  'cta-card': [
    { key: 'cta', label: 'CTA', maxLen: 60 },
    { key: 'handle', label: 'Handle', maxLen: 30 },
  ],
  'media-only': [],
  transition: [],
  'cover-slide': [
    { key: 'title', label: 'Title', maxLen: 80 },
    { key: 'subtitle', label: 'Subtitle', maxLen: 120, multiline: true },
  ],
  'content-slide': [
    { key: 'heading', label: 'Heading', maxLen: 80 },
    { key: 'body', label: 'Body', maxLen: 300, multiline: true },
  ],
  'quote-slide': [
    { key: 'quote', label: 'Quote', maxLen: 200, multiline: true },
    { key: 'attribution', label: 'Attribution', maxLen: 50 },
  ],
  'list-slide': [{ key: 'title', label: 'Title', maxLen: 60 }],
  'cta-slide': [
    { key: 'cta', label: 'CTA', maxLen: 60 },
    { key: 'handle', label: 'Handle', maxLen: 30 },
  ],
}

const SCENE_TYPE_LABEL: Record<string, string> = {
  'hook-text': 'Hook',
  'text-over-media': 'Text over media',
  'quote-card': 'Quote card',
  'list-reveal': 'List reveal',
  'media-only': 'Media only',
  'cta-card': 'CTA',
  transition: 'Transition',
  'cover-slide': 'Cover slide',
  'content-slide': 'Content slide',
  'quote-slide': 'Quote slide',
  'list-slide': 'List slide',
  'cta-slide': 'CTA slide',
}

interface Props {
  composition: {
    id: string
    status: string
    format: string | null
    caption: string | null
    hashtags: string[]
    creative: any
    idea: { ideaText: string } | null
    template: { name: string } | null
  }
  backUrl: string
}

export default function DraftEditor({ composition, backUrl }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [actioning, setActioning] = useState(false)

  // Editable state
  const [caption, setCaption] = useState(composition.caption ?? '')
  const [hashtagsRaw, setHashtagsRaw] = useState(composition.hashtags.join(' '))
  const [scenes, setScenes] = useState<any[]>(composition.creative?.scenes ?? [])

  const isDraft = composition.status === 'DRAFT'
  const FormatIcon = (composition.format ? FORMAT_ICON[composition.format] : null) ?? Film

  const updateSlot = (sceneIdx: number, key: string, value: string) => {
    setScenes((prev) =>
      prev.map((s, i) =>
        i === sceneIdx ? { ...s, slots: { ...s.slots, [key]: value } } : s,
      ),
    )
  }

  const updateListItem = (sceneIdx: number, itemIdx: number, value: string) => {
    setScenes((prev) =>
      prev.map((s, i) => {
        if (i !== sceneIdx) return s
        const items = [...(s.slots?.items ?? [])]
        items[itemIdx] = value
        return { ...s, slots: { ...s.slots, items } }
      }),
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const hashtags = hashtagsRaw
        .split(/[\s,#]+/)
        .map((t) => t.trim())
        .filter(Boolean)

      const res = await fetch(`/api/compositions/${composition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          hashtags,
          creative: { ...composition.creative, scenes },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Draft saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    await handleSave()
    setActioning(true)
    try {
      const res = await fetch(`/api/compositions/${composition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Approved for scheduling')
      router.push(backUrl)
    } catch {
      toast.error('Failed to approve')
    } finally {
      setActioning(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this draft permanently?')) return
    setActioning(true)
    try {
      await fetch(`/api/compositions/${composition.id}`, { method: 'DELETE' })
      router.push(backUrl)
    } catch {
      toast.error('Failed to delete')
      setActioning(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Back */}
      <button
        onClick={() => router.push(backUrl)}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-white transition-colors w-fit"
      >
        <ChevronLeft size={16} /> Back to Pool
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[composition.status] ?? 'bg-gray-800 text-gray-400'}`}
            >
              {composition.status}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase bg-gray-800 text-gray-400">
              <FormatIcon size={9} />
              {(composition.format ? FORMAT_LABEL[composition.format] : null) ?? composition.format}
            </span>
            {composition.template?.name && (
              <span className="text-[10px] text-gray-500">{composition.template.name}</span>
            )}
          </div>
          {composition.idea?.ideaText && (
            <p className="text-sm text-text-secondary leading-relaxed">{composition.idea.ideaText}</p>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={actioning || saving}
            className="border-gray-700 px-3"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving || actioning}
            className="border-gray-700 gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </Button>
          {isDraft && (
            <Button
              onClick={handleApprove}
              disabled={actioning || saving}
              className="bg-accent hover:bg-accent/80 gap-1.5"
            >
              {actioning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Approve
            </Button>
          )}
        </div>
      </div>

      {/* Scenes */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Scenes ({scenes.length})
        </h3>
        {scenes.map((scene, idx) => {
          const slotFields = SLOT_META[scene.type] ?? []
          const hasItems = scene.type === 'list-reveal' || scene.type === 'list-slide'

          return (
            <Card key={idx} className="p-4 border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  {idx + 1}
                </span>
                <span className="text-xs font-semibold text-gray-300">
                  {SCENE_TYPE_LABEL[scene.type] ?? scene.type}
                </span>
                {scene.mood && (
                  <span className="text-[10px] text-gray-600 ml-auto">mood: {scene.mood}</span>
                )}
              </div>

              {slotFields.length === 0 && !hasItems && (
                <p className="text-xs text-gray-600 italic">No editable slots</p>
              )}

              <div className="flex flex-col gap-3">
                {slotFields.map(({ key, label, maxLen, multiline }) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
                        {label}
                      </label>
                      <span className="text-[10px] text-gray-600">
                        {String(scene.slots?.[key] ?? '').length}/{maxLen}
                      </span>
                    </div>
                    {multiline ? (
                      <textarea
                        value={scene.slots?.[key] ?? ''}
                        onChange={(e) => updateSlot(idx, key, e.target.value)}
                        maxLength={maxLen}
                        rows={2}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent resize-none"
                      />
                    ) : (
                      <input
                        value={scene.slots?.[key] ?? ''}
                        onChange={(e) => updateSlot(idx, key, e.target.value)}
                        maxLength={maxLen}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                      />
                    )}
                  </div>
                ))}

                {hasItems && (
                  <div>
                    <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wide block mb-1">
                      Items
                    </label>
                    <div className="flex flex-col gap-2">
                      {(scene.slots?.items ?? []).map((item: string, itemIdx: number) => (
                        <div key={itemIdx} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-600 w-4 shrink-0">{itemIdx + 1}.</span>
                          <input
                            value={item}
                            onChange={(e) => updateListItem(idx, itemIdx, e.target.value)}
                            maxLength={80}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Caption */}
      <Card className="p-4 border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <AlignLeft size={13} className="text-text-secondary" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Caption</h3>
          <span className="text-[10px] text-gray-600 ml-auto">{caption.length}/2200</span>
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={2200}
          rows={6}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent resize-none"
        />
      </Card>

      {/* Hashtags */}
      <Card className="p-4 border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Hash size={13} className="text-text-secondary" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Hashtags</h3>
        </div>
        <input
          value={hashtagsRaw}
          onChange={(e) => setHashtagsRaw(e.target.value)}
          placeholder="topic niche content (space or comma separated, # optional)"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {hashtagsRaw
            .split(/[\s,#]+/)
            .filter(Boolean)
            .map((tag, i) => (
              <span key={i} className="text-[11px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
        </div>
      </Card>

      {/* Bottom save */}
      <div className="flex justify-end gap-2 pb-8">
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={saving || actioning}
          className="border-gray-700 gap-1.5"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save draft
        </Button>
        {isDraft && (
          <Button
            onClick={handleApprove}
            disabled={actioning || saving}
            className="bg-accent hover:bg-accent/80 gap-1.5"
          >
            {actioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Save & Approve
          </Button>
        )}
      </div>
    </div>
  )
}
