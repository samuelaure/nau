'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createId } from '@paralleldrive/cuid2'
import {
  GripVertical,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Video,
  X,
  Loader2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  Maximize2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/modules/shared/utils'
import type {
  SceneDef,
  TextDef,
  TextStyle,
  HorizontalAlign,
  VerticalAlign,
} from '@/types/template-scenes'
import {
  DEFAULT_TEXT_DEF,
  DEFAULT_SCENE_DEF,
  calcSceneDurationFrames,
  calcTotalReelFrames,
  REMOTION_FPS,
  MAX_REEL_DURATION_SECS,
} from '@/types/template-scenes'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPORTED_FONTS = [
  'Anton', 'Bebas Neue', 'Oswald', 'Inter', 'Montserrat', 'Poppins',
  'DM Sans', 'Nunito', 'Raleway', 'Playfair Display', 'Black Han Sans',
  'Manrope', 'Urbanist', 'Outfit', 'Figtree', 'Space Grotesk', 'Sora',
  'Lato', 'Roboto', 'Work Sans', 'Barlow', 'Kanit', 'Merriweather',
  'Lora', 'Cormorant', 'Libre Baskerville', 'Crimson Text', 'Cinzel',
  'Teko', 'Righteous', 'Archivo Black', 'Barlow Condensed', 'Dancing Script',
  'Sacramento', 'Satisfy', 'Pacifico', 'Caveat',
]

// ─── Video picker modal ────────────────────────────────────────────────────────

interface VideoAsset {
  id: string
  url: string
  thumbnailUrl?: string | null
  duration?: number | null
  systemFilename: string
}

function VideoPickerModal({
  brandId,
  currentAssetId,
  onSelect,
  onClose,
}: {
  brandId: string
  currentAssetId?: string | null
  onSelect: (asset: VideoAsset) => void
  onClose: () => void
}) {
  const [assets, setAssets] = useState<VideoAsset[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch video assets once on mount
  useState(() => {
    fetch(`/api/protected/assets?brandId=${brandId}&type=video`)
      .then((r) => r.json())
      .then((d) => {
        setAssets((d.assets || []).filter((a: any) => a.type === 'VID' || a.mimeType?.startsWith('video/')))
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load videos')
        setLoading(false)
      })
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl max-h-[80vh] flex flex-col bg-gray-950 border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="font-semibold text-sm">Select Background Video</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-600" />
            </div>
          ) : assets.length === 0 ? (
            <p className="text-center text-sm text-gray-600 py-12">No video assets uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelect(a)}
                  className={cn(
                    'relative aspect-video rounded-lg overflow-hidden border-2 transition-all group',
                    currentAssetId === a.id
                      ? 'border-accent'
                      : 'border-transparent hover:border-gray-600',
                  )}
                >
                  {a.thumbnailUrl ? (
                    <img src={a.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <video src={a.url} className="w-full h-full object-cover" preload="metadata" muted />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-end p-1 transition-opacity">
                    <span className="text-[10px] text-white truncate leading-tight">
                      {a.systemFilename}
                      {a.duration ? ` · ${Math.round(a.duration)}s` : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-gray-800 px-4 py-3 text-xs text-gray-600 text-center">
          Leave empty for automatic random selection from your brand assets.
        </div>
      </div>
    </div>
  )
}

// ─── TextBlockEditor ──────────────────────────────────────────────────────────

function SortableTextBlock({
  text,
  onChange,
  onRemove,
}: {
  text: TextDef
  onChange: (patch: Partial<TextDef>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: text.id,
  })
  const [expanded, setExpanded] = useState(true)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden"
    >
      {/* Text block header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/60">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex-1 text-left flex items-center gap-2 min-w-0"
        >
          <span className="text-xs font-medium text-gray-400 truncate">
            {text.content
              ? `"${text.content.slice(0, 40)}${text.content.length > 40 ? '…' : ''}"`
              : 'Text block'}
          </span>
          <span
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded border shrink-0',
              text.mode === 'prompt'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            )}
          >
            {text.mode}
          </span>
        </button>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-gray-600 hover:text-white transition-colors shrink-0"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button
          onClick={onRemove}
          className="text-gray-700 hover:text-red-400 transition-colors shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Mode toggle */}
          <div>
            <div className="flex rounded-md border border-gray-800 overflow-hidden w-fit">
              {(['prompt', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onChange({ mode: m })}
                  className={cn(
                    'px-3 py-1 text-xs font-medium transition-colors capitalize',
                    text.mode === m
                      ? 'bg-accent text-black'
                      : 'text-gray-500 hover:text-white bg-transparent',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5">
              {text.mode === 'prompt'
                ? '💡 Prompt mode: write instructions for the AI. The AI will generate the text content for this block.'
                : '✍️ Manual mode: the exact text you write here will appear on screen — no AI.'}
            </p>
          </div>

          {/* Content */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              {text.mode === 'prompt' ? 'Prompt instructions' : 'Text content'}
            </label>
            <textarea
              value={text.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder={
                text.mode === 'prompt'
                  ? 'e.g. "A bold claim about the topic — 5-8 words, punchy"'
                  : 'e.g. "The world changed overnight."'
              }
              className="mt-1 w-full text-xs bg-gray-900 border border-gray-800 text-white rounded px-2.5 py-2 resize-none min-h-[64px] focus:outline-none focus:border-gray-600 placeholder:text-gray-700 leading-relaxed"
            />
          </div>

          {/* Min/max words — only for prompt mode */}
          {text.mode === 'prompt' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Min words
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={text.minWords ?? ''}
                  onChange={(e) =>
                    onChange({ minWords: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  placeholder="auto"
                  className="mt-1 w-full text-xs bg-gray-900 border border-gray-800 text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-gray-600"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Max words
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={text.maxWords ?? ''}
                  onChange={(e) =>
                    onChange({ maxWords: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  placeholder="auto"
                  className="mt-1 w-full text-xs bg-gray-900 border border-gray-800 text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-gray-600"
                />
              </div>
            </div>
          )}

          {/* Font */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Font</label>
            <select
              value={text.font}
              onChange={(e) => onChange({ font: e.target.value })}
              className="mt-1 w-full text-xs bg-gray-900 border border-gray-800 text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-gray-600"
            >
              {SUPPORTED_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Color + max text size */}
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Text color
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={text.color}
                  onChange={(e) => onChange({ color: e.target.value })}
                  className="w-7 h-7 rounded border border-gray-700 bg-gray-900 cursor-pointer p-0.5"
                />
                <span className="text-[10px] text-gray-600 font-mono">{text.color}</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Max size (%)
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={text.maxTextSize}
                onChange={(e) => onChange({ maxTextSize: Math.min(100, Math.max(10, parseInt(e.target.value) || 100)) })}
                className="mt-1 w-full text-xs bg-gray-900 border border-gray-800 text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-gray-600"
              />
            </div>
          </div>

          {/* Text style */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">
              Text style
            </label>
            <div className="flex gap-1">
              {(['none', 'stroke', 'background_block'] as TextStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ textStyle: s })}
                  className={cn(
                    'px-2 py-1 text-[10px] rounded border transition-colors',
                    text.textStyle === s
                      ? 'bg-accent text-black border-accent'
                      : 'bg-gray-900 text-gray-500 border-gray-800 hover:text-white',
                  )}
                >
                  {s === 'none' ? 'None' : s === 'stroke' ? 'Outline' : 'Background'}
                </button>
              ))}
            </div>
            {text.textStyle !== 'none' && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] text-gray-500">
                  {text.textStyle === 'stroke' ? 'Stroke color' : 'Background color'}
                </label>
                <input
                  type="color"
                  value={text.styleColor}
                  onChange={(e) => onChange({ styleColor: e.target.value })}
                  className="w-6 h-6 rounded border border-gray-700 bg-gray-900 cursor-pointer p-0.5"
                />
                <span className="text-[10px] text-gray-600 font-mono">{text.styleColor}</span>
              </div>
            )}
          </div>

          {/* Horizontal align */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">
              Text align
            </label>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as HorizontalAlign[]).map((a) => (
                <button
                  key={a}
                  onClick={() => onChange({ horizontalAlign: a })}
                  className={cn(
                    'p-1.5 rounded border transition-colors',
                    text.horizontalAlign === a
                      ? 'bg-accent text-black border-accent'
                      : 'bg-gray-900 text-gray-600 border-gray-800 hover:text-white',
                  )}
                >
                  {a === 'left' ? <AlignLeft size={13} /> : a === 'center' ? <AlignCenter size={13} /> : <AlignRight size={13} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SceneBlock ───────────────────────────────────────────────────────────────

type BrandDefaults = {
  titleFont?: string
  primaryColor?: string
  overlayOpacity?: number
  maxTextSize?: number
}

function SortableSceneBlock({
  scene,
  index,
  brandId,
  brandDefaults,
  onChange,
  onRemove,
}: {
  scene: SceneDef
  index: number
  brandId: string
  brandDefaults?: BrandDefaults | null
  onChange: (patch: Partial<SceneDef>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
  })
  const [showVideoPicker, setShowVideoPicker] = useState(false)
  const [textsDndActive, setTextsDndActive] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleTextDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const oldIndex = scene.texts.findIndex((t) => t.id === active.id)
        const newIndex = scene.texts.findIndex((t) => t.id === over.id)
        onChange({ texts: arrayMove(scene.texts, oldIndex, newIndex) })
      }
    },
    [scene.texts, onChange],
  )

  const addText = () => {
    const newText: TextDef = {
      ...DEFAULT_TEXT_DEF,
      ...(brandDefaults?.titleFont ? { font: brandDefaults.titleFont } : {}),
      ...(brandDefaults?.primaryColor ? { color: brandDefaults.primaryColor } : {}),
      ...(brandDefaults?.maxTextSize ? { maxTextSize: brandDefaults.maxTextSize } : {}),
      id: createId(),
      content: '',
    }
    onChange({ texts: [...scene.texts, newText] })
  }

  const updateText = (textId: string, patch: Partial<TextDef>) => {
    onChange({
      texts: scene.texts.map((t) => (t.id === textId ? { ...t, ...patch } : t)),
    })
  }

  const removeText = (textId: string) => {
    onChange({ texts: scene.texts.filter((t) => t.id !== textId) })
  }

  const durationSecs = Math.round((calcSceneDurationFrames(scene) / REMOTION_FPS) * 10) / 10

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-800 rounded-xl overflow-hidden"
    >
      {/* Scene header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-800">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={15} />
        </button>
        <span className="text-xs font-semibold text-gray-300 flex-1">
          Scene {index + 1}
          <span className="text-gray-600 font-normal ml-2">~{durationSecs}s</span>
        </span>
        <button
          onClick={onRemove}
          className="text-gray-700 hover:text-red-400 transition-colors"
          title="Remove scene"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4 bg-gray-950/50">
        {/* Background video */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            Background video
          </label>
          {scene.backgroundVideoAssetId && scene.backgroundVideoUrl ? (
            <div className="flex items-center gap-3">
              <video
                src={scene.backgroundVideoUrl}
                className="w-16 h-16 rounded-md object-cover border border-gray-800 shrink-0"
                muted
                preload="metadata"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 truncate">Pinned video</p>
                {scene.backgroundVideoDurationSecs && (
                  <p className="text-[10px] text-gray-600">
                    {Math.round(scene.backgroundVideoDurationSecs)}s
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowVideoPicker(true)}
                  className="text-[10px] text-gray-500 hover:text-white border border-gray-800 rounded px-2 py-1 transition-colors"
                >
                  Change
                </button>
                <button
                  onClick={() =>
                    onChange({
                      backgroundVideoAssetId: null,
                      backgroundVideoUrl: null,
                      backgroundVideoDurationSecs: null,
                    })
                  }
                  className="text-[10px] text-red-500/70 hover:text-red-400 border border-red-800/30 rounded px-2 py-1 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowVideoPicker(true)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-dashed border-gray-800 hover:border-gray-600 rounded-lg px-3 py-2.5 transition-all w-full"
            >
              <Video size={13} />
              Add background video
              <span className="ml-auto text-[10px] text-gray-700">Leave empty for random</span>
            </button>
          )}
        </div>

        {/* Overlay */}
        <div className="flex gap-4 items-end">
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              Overlay color
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={scene.overlayColor}
                onChange={(e) => onChange({ overlayColor: e.target.value })}
                className="w-7 h-7 rounded border border-gray-700 bg-gray-900 cursor-pointer p-0.5"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              Overlay opacity ({Math.round(scene.overlayOpacity * 100)}%)
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={scene.overlayOpacity}
              onChange={(e) => onChange({ overlayOpacity: parseFloat(e.target.value) })}
              className="mt-1 w-full accent-accent"
            />
          </div>
        </div>

        {/* Text vertical alignment */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">
            Text position
          </label>
          <div className="flex gap-1">
            {(['top', 'center', 'bottom'] as VerticalAlign[]).map((a) => (
              <button
                key={a}
                onClick={() => onChange({ textVerticalAlign: a })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize',
                  scene.textVerticalAlign === a
                    ? 'bg-accent text-black border-accent'
                    : 'bg-gray-900 text-gray-500 border-gray-800 hover:text-white',
                )}
              >
                <AlignVerticalJustifyCenter size={11} />
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Text blocks */}
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            Text blocks ({scene.texts.length})
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleTextDragEnd}
          >
            <SortableContext
              items={scene.texts.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {scene.texts.map((text) => (
                <SortableTextBlock
                  key={text.id}
                  text={text}
                  onChange={(patch) => updateText(text.id, patch)}
                  onRemove={() => removeText(text.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            onClick={addText}
            className="flex items-center gap-2 w-full text-xs text-gray-500 hover:text-white border border-dashed border-gray-800 hover:border-gray-600 rounded-lg px-3 py-2 transition-all"
          >
            <Plus size={12} />
            Add Text Block
          </button>
        </div>
      </div>

      {showVideoPicker && (
        <VideoPickerModal
          brandId={brandId}
          currentAssetId={scene.backgroundVideoAssetId}
          onSelect={(asset) => {
            onChange({
              backgroundVideoAssetId: asset.id,
              backgroundVideoUrl: asset.url,
              backgroundVideoDurationSecs: asset.duration ?? null,
            })
            setShowVideoPicker(false)
          }}
          onClose={() => setShowVideoPicker(false)}
        />
      )}
    </div>
  )
}

// ─── Main ReelSceneBuilder ─────────────────────────────────────────────────────

export interface ReelSceneBuilderProps {
  scenes: SceneDef[]
  brandId: string
  brandDefaults?: BrandDefaults | null
  onSave: (scenes: SceneDef[]) => Promise<void>
  saving?: boolean
}

export function ReelSceneBuilder({ scenes: initialScenes, brandId, brandDefaults, onSave, saving }: ReelSceneBuilderProps) {
  const [scenes, setScenes] = useState<SceneDef[]>(initialScenes)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleSceneDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id)
      const newIndex = scenes.findIndex((s) => s.id === over.id)
      setScenes((prev) => arrayMove(prev, oldIndex, newIndex))
    }
  }

  const addScene = () => {
    const newScene: SceneDef = {
      ...DEFAULT_SCENE_DEF,
      ...(brandDefaults?.overlayOpacity != null ? { overlayOpacity: brandDefaults.overlayOpacity } : {}),
      id: createId(),
      texts: [
        {
          ...DEFAULT_TEXT_DEF,
          ...(brandDefaults?.titleFont ? { font: brandDefaults.titleFont } : {}),
          ...(brandDefaults?.primaryColor ? { color: brandDefaults.primaryColor } : {}),
          ...(brandDefaults?.maxTextSize ? { maxTextSize: brandDefaults.maxTextSize } : {}),
          id: createId(),
          content: '',
        },
      ],
    }
    setScenes((prev) => [...prev, newScene])
  }

  const updateScene = (sceneId: string, patch: Partial<SceneDef>) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)))
  }

  const removeScene = (sceneId: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== sceneId))
  }

  const totalSecs = Math.round((calcTotalReelFrames(scenes) / REMOTION_FPS) * 10) / 10
  const overCap = totalSecs >= MAX_REEL_DURATION_SECS

  return (
    <div className="space-y-4">
      {/* Duration indicator */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
          Scenes ({scenes.length})
        </p>
        <span
          className={cn(
            'text-[10px] px-2 py-0.5 rounded border font-mono',
            overCap
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-gray-900 text-gray-500 border-gray-800',
          )}
        >
          ~{totalSecs}s / {MAX_REEL_DURATION_SECS}s max
        </span>
      </div>
      {overCap && (
        <p className="text-[10px] text-red-400">
          ⚠️ Total duration exceeds 3 minutes — the video will be capped at 3 min.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSceneDragEnd}
      >
        <SortableContext
          items={scenes.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {scenes.map((scene, i) => (
            <SortableSceneBlock
              key={scene.id}
              scene={scene}
              index={i}
              brandId={brandId}
              brandDefaults={brandDefaults}
              onChange={(patch) => updateScene(scene.id, patch)}
              onRemove={() => removeScene(scene.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={addScene}
        className="flex items-center gap-2 w-full text-sm text-gray-500 hover:text-white border-2 border-dashed border-gray-800 hover:border-gray-600 rounded-xl px-4 py-3 transition-all"
      >
        <Plus size={14} />
        Add Scene
      </button>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => onSave(scenes)}
          disabled={saving}
          className="flex items-center gap-2 bg-white text-black text-xs font-semibold rounded-lg px-4 py-2 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Maximize2 size={13} />}
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}
