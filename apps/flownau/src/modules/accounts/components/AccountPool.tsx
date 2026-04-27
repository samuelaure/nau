'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import {
  Trash2,
  CheckCircle2,
  Upload,
  Share2,
  Film,
  Play,
  Mic,
  LayoutGrid,
  ImageIcon,
  Loader2,
  AlertCircle,
  Layers,
  ChevronRight,
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
  DRAFT: 'bg-orange-900/60 text-orange-400',
  APPROVED: 'bg-green-900/60 text-green-400',
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
  source: string
  caption: string | null
  hashtags: string[]
  creative: any
  createdAt: string
  template: { id: string; name: string; sceneType: string | null } | null
  idea: { ideaText: string } | null
}

export default function AccountPool({
  brandId,
  workspaceId,
}: {
  brandId: string
  workspaceId: string
}) {
  const router = useRouter()
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchCompositions = async () => {
    try {
      const res = await fetch(`/api/compositions?brandId=${brandId}&pool=1`)
      const data = await res.json()
      setCompositions(data.compositions || [])
    } catch {
      toast.error('Failed to load pool')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompositions()
  }, [brandId])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this draft?')) return
    try {
      await fetch(`/api/compositions/${id}`, { method: 'DELETE' })
      setCompositions((prev) => prev.filter((c) => c.id !== id))
    } catch {
      toast.error('Failed to delete draft')
    }
  }

  const handleApprove = async (id: string) => {
    setActioningId(id)
    try {
      const res = await fetch(`/api/compositions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Approved for scheduling')
      fetchCompositions()
    } catch {
      toast.error('Failed to approve')
    } finally {
      setActioningId(null)
    }
  }

  const handleMarkAsPosted = async (id: string) => {
    if (!confirm('Mark this as already posted externally?')) return
    setActioningId(id)
    try {
      const res = await fetch(`/api/compositions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Marked as published')
      fetchCompositions()
    } catch {
      toast.error('Failed to mark as posted')
    } finally {
      setActioningId(null)
    }
  }

  const handleUploadRecording = async (id: string, file: File) => {
    setActioningId(id)
    const toastId = toast.loading('Uploading recording...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('compositionId', id)
      formData.append('brandId', brandId)
      const res = await fetch('/api/compositions/upload-recording', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).error || 'Upload failed')
      toast.success('Recording uploaded', { id: toastId })
      fetchCompositions()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setActioningId(null)
    }
  }

  const draftCount = compositions.filter((c) => c.status === 'DRAFT').length

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
        <h3 className="text-xl font-heading font-semibold">Pool</h3>
        <p className="text-xs text-text-secondary mt-0.5">
          Drafts awaiting review before scheduling.
        </p>
      </div>

      {draftCount > 0 && (
        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
          <p className="text-sm text-orange-300">
            <strong>{draftCount}</strong> {draftCount === 1 ? 'draft' : 'drafts'} waiting for review
          </p>
        </div>
      )}

      {compositions.length === 0 && (
        <div className="text-center py-16 text-text-secondary border border-dashed border-gray-800 rounded-lg">
          <Layers className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No drafts in the pool yet.</p>
          <p className="text-xs mt-1 opacity-60">Approve ideas from Ideas to generate drafts here.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {compositions.map((comp) => {
          const isDraft = comp.status === 'DRAFT'
          const isHeadTalk = comp.format === 'head_talk'
          const FormatIcon = FORMAT_ICON[comp.format] ?? Film
          const busy = actioningId === comp.id
          const scenes: any[] = comp.creative?.scenes ?? []
          const draftUrl = `/dashboard/workspace/${workspaceId}/draft/${comp.id}?brandId=${brandId}`

          return (
            <Card
              key={comp.id}
              className={`border ${isDraft ? 'border-orange-900/30' : 'border-gray-800'} p-4 hover:border-gray-600 transition-colors`}
            >
              {/* Top row: badges + date */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[comp.status] ?? 'bg-gray-800 text-gray-400'}`}
                  >
                    {comp.status}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase bg-gray-800 text-gray-400">
                    <FormatIcon size={9} />
                    {FORMAT_LABEL[comp.format] ?? comp.format}
                  </span>
                </div>
                <span className="text-[10px] text-gray-600">
                  {new Date(comp.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Idea text */}
              {comp.idea?.ideaText && (
                <p className="text-sm text-white leading-snug mb-2 line-clamp-2">
                  {comp.idea.ideaText}
                </p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
                {comp.template?.name && (
                  <span className="flex items-center gap-1">
                    <Layers size={10} />
                    {comp.template.name}
                  </span>
                )}
                {scenes.length > 0 && (
                  <span>{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Caption preview */}
              {comp.caption && (
                <p className="text-[11px] text-gray-500 line-clamp-2 mb-3 italic">
                  {comp.caption}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                {/* Open detail */}
                <button
                  onClick={() => router.push(draftUrl)}
                  className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-500 hover:bg-white/5 text-sm text-gray-300 transition-colors"
                >
                  <span>Open draft</span>
                  <ChevronRight size={14} />
                </button>

                {isDraft && !isHeadTalk && (
                  <Button
                    disabled={busy}
                    onClick={() => handleApprove(comp.id)}
                    className="bg-accent hover:bg-accent/80 px-3 flex items-center gap-1.5 text-sm"
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Approve
                  </Button>
                )}

                {isHeadTalk && comp.status !== 'PUBLISHED' && (
                  <>
                    <input
                      ref={(el) => { uploadRefs.current[comp.id] = el }}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUploadRecording(comp.id, file)
                        e.target.value = ''
                      }}
                    />
                    <Button
                      disabled={busy}
                      onClick={() => uploadRefs.current[comp.id]?.click()}
                      className="bg-blue-700 hover:bg-blue-600 px-3 flex items-center gap-1.5 text-xs"
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload
                    </Button>
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => handleMarkAsPosted(comp.id)}
                      className="border-gray-700 px-3 flex items-center gap-1.5 text-xs"
                    >
                      <Share2 className="w-3 h-3" />
                      Posted
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleDelete(comp.id)}
                  className="border-gray-700 hover:bg-gray-800 px-3"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
