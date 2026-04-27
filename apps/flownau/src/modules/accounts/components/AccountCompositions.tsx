'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import {
  Film,
  Play,
  Mic,
  LayoutGrid,
  ImageIcon,
  Loader2,
  CheckCircle2,
  Video,
  Layers,
} from 'lucide-react'

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
  static_post: 'Static Post',
  story: 'Story',
}

const STATUS_STYLE: Record<string, string> = {
  RENDERING: 'bg-blue-900/60 text-blue-400',
  RENDERED: 'bg-cyan-900/60 text-cyan-400',
  SCHEDULED: 'bg-purple-900/60 text-purple-400',
  PUBLISHING: 'bg-yellow-900/60 text-yellow-400',
  PUBLISHED: 'bg-gray-700 text-gray-400',
  FAILED: 'bg-red-900/60 text-red-400',
}

interface Composition {
  id: string
  status: string
  format: string
  caption: string | null
  hashtags: string[]
  createdAt: string
  videoUrl: string | null
  renderedVideoUrl: string | null
  template: { name: string } | null
  idea: { ideaText: string } | null
}

export default function AccountCompositions({ brandId }: { brandId: string }) {
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)

  const fetchCompositions = async () => {
    try {
      const res = await fetch(`/api/compositions?brandId=${brandId}`)
      const data = await res.json()
      // Filter to post-render statuses only — pool handles DRAFT/APPROVED
      const rendered = (data.compositions ?? []).filter((c: Composition) =>
        ['RENDERING', 'RENDERED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED'].includes(c.status),
      )
      setCompositions(rendered)
    } catch {
      toast.error('Failed to load compositions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompositions()
  }, [brandId])

  const handleMarkPublished = async (id: string) => {
    if (!confirm('Mark as published?')) return
    setActioningId(id)
    try {
      await fetch(`/api/compositions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      })
      toast.success('Marked as published')
      fetchCompositions()
    } catch {
      toast.error('Failed to update')
    } finally {
      setActioningId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xl font-heading font-semibold">Compositions</h3>
        <p className="text-xs text-text-secondary mt-0.5">
          Rendered and published content.
        </p>
      </div>

      {compositions.length === 0 && (
        <div className="text-center py-16 text-text-secondary border border-dashed border-gray-800 rounded-lg">
          <Video className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No rendered compositions yet.</p>
          <p className="text-xs mt-1 opacity-60">
            Approve drafts from the Pool to schedule and render them.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {compositions.map((comp) => {
          const FormatIcon = FORMAT_ICON[comp.format] ?? Film
          const busy = actioningId === comp.id
          const videoSrc = comp.renderedVideoUrl ?? comp.videoUrl

          return (
            <Card key={comp.id} className="p-4 border-gray-800">
              <div className="flex items-start gap-4">
                {/* Thumbnail / video indicator */}
                <div className="w-16 h-16 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center shrink-0">
                  {videoSrc ? (
                    <a
                      href={videoSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-full h-full"
                    >
                      <Play size={20} className="text-accent" />
                    </a>
                  ) : (
                    <FormatIcon size={20} className="text-gray-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[comp.status] ?? 'bg-gray-800 text-gray-400'}`}
                    >
                      {comp.status}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase bg-gray-800 text-gray-400">
                      <FormatIcon size={9} />
                      {FORMAT_LABEL[comp.format] ?? comp.format}
                    </span>
                    {comp.template?.name && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        <Layers size={9} />
                        {comp.template.name}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-600 ml-auto">
                      {new Date(comp.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Idea text */}
                  {comp.idea?.ideaText && (
                    <p className="text-sm text-white leading-snug mb-1 line-clamp-2">
                      {comp.idea.ideaText}
                    </p>
                  )}

                  {/* Caption */}
                  {comp.caption && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 italic">{comp.caption}</p>
                  )}
                </div>

                {/* Actions */}
                {comp.status === 'RENDERED' && (
                  <Button
                    disabled={busy}
                    onClick={() => handleMarkPublished(comp.id)}
                    className="shrink-0 bg-green-800 hover:bg-green-700 gap-1.5 text-xs"
                  >
                    {busy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    Mark published
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
