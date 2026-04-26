'use client'

import { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { Player } from '@remotion/player'

const DynamicCompositionMock = dynamic(
  () =>
    import('@/modules/rendering/DynamicCompositionMock/DynamicCompositionMock').then(
      (mod) => mod.DynamicCompositionMock,
    ),
  { ssr: false },
)

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
  DRAFT: 'bg-orange-900 text-orange-400',
  APPROVED: 'bg-green-900 text-green-400',
  RENDERING: 'bg-blue-900 text-blue-400',
  RENDERED: 'bg-cyan-900 text-cyan-400',
  SCHEDULED: 'bg-purple-900 text-purple-400',
  PUBLISHING: 'bg-yellow-900 text-yellow-400',
  PUBLISHED: 'bg-gray-700 text-gray-400',
  FAILED: 'bg-red-900 text-red-400',
}

export default function AccountPool({ brandId }: { brandId: string }) {
  const [compositions, setCompositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchCompositions = async () => {
    try {
      const res = await fetch(`/api/compositions?brandId=${brandId}&pool=1`)
      const data = await res.json()
      setCompositions(data.compositions || [])
    } catch {
      toast.error('Failed to load compositions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompositions()
  }, [brandId])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this composition?')) return
    try {
      await fetch(`/api/compositions/${id}`, { method: 'DELETE' })
      setCompositions((prev) => prev.filter((c) => c.id !== id))
    } catch {
      toast.error('Failed to delete composition')
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
      toast.success('Composition approved for scheduling!')
      fetchCompositions()
    } catch {
      toast.error('Failed to approve composition')
    } finally {
      setActioningId(null)
    }
  }

  const handleMarkAsPosted = async (id: string) => {
    if (!confirm('Mark this head_talk as already posted externally?')) return
    setActioningId(id)
    try {
      const res = await fetch(`/api/compositions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Marked as published.')
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

      const res = await fetch('/api/compositions/upload-recording', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Upload failed')
      toast.success('Recording uploaded! Composition moved to Rendered.', { id: toastId })
      fetchCompositions()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setActioningId(null)
    }
  }

  const draftCount = compositions.filter((c) => c.status === 'DRAFT').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-heading font-semibold">Content Pool</h3>
          <p className="text-xs text-gray-500">
            Drafts awaiting review, then scheduled for publishing.
          </p>
        </div>
      </div>

      {draftCount > 0 && (
        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
          <p className="text-sm text-orange-300">
            <strong>{draftCount}</strong> {draftCount === 1 ? 'item' : 'items'} waiting for review
            in the pool.
          </p>
        </div>
      )}

      {!loading && compositions.length === 0 && (
        <div className="text-center py-10 text-text-secondary border border-dashed border-gray-800 rounded-lg">
          No compositions in the pool yet. Approve ideas from the Backlog to generate them here.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {compositions.map((comp) => {
          const isDraft = comp.status === 'DRAFT'
          const isHeadTalk = comp.format === 'head_talk'
          const isReplicate = comp.source === 'replicate'
          const script = isHeadTalk ? (comp.payload as any)?.script : null
          const FormatIcon = FORMAT_ICON[comp.format] ?? Film
          const busy = actioningId === comp.id

          return (
            <Card
              key={comp.id}
              className={`bg-gray-900 border ${isDraft ? 'border-orange-900/40' : 'border-gray-800'} p-4 flex flex-col gap-4`}
            >
              {/* Header */}
              <div className="flex justify-between items-center">
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
                  {isReplicate && (
                    <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Replicate
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-600">
                  {new Date(comp.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Content preview */}
              {isHeadTalk ? (
                <div className="bg-gray-950 rounded-lg p-3 border border-gray-800 max-h-[200px] overflow-y-auto">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                    Script
                  </p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {script}
                  </p>
                </div>
              ) : (
                <div className="w-full aspect-[9/16] bg-black rounded-lg overflow-hidden relative shadow-lg">
                  <Player
                    component={DynamicCompositionMock as any}
                    inputProps={{ schema: comp.payload }}
                    durationInFrames={Math.max(1, (comp.payload as any)?.durationInFrames || 150)}
                    fps={Math.max(1, (comp.payload as any)?.fps || 30)}
                    compositionWidth={Math.max(1, (comp.payload as any)?.width || 1080)}
                    compositionHeight={Math.max(1, (comp.payload as any)?.height || 1920)}
                    style={{ width: '100%', height: '100%' }}
                    controls
                    loop
                  />
                </div>
              )}

              {/* Caption preview */}
              {comp.caption && <p className="text-xs text-gray-500 line-clamp-2">{comp.caption}</p>}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {isDraft && !isHeadTalk && (
                  <Button
                    disabled={busy}
                    onClick={() => handleApprove(comp.id)}
                    className="flex-1 bg-accent hover:bg-accent/80 flex items-center gap-2 justify-center"
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approve
                  </Button>
                )}

                {isHeadTalk && comp.status !== 'PUBLISHED' && (
                  <>
                    {/* Upload recording → RENDERED */}
                    <input
                      ref={(el) => {
                        uploadRefs.current[comp.id] = el
                      }}
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
                      className="flex-1 bg-blue-700 hover:bg-blue-600 flex items-center gap-2 justify-center text-xs"
                    >
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      Upload Recording
                    </Button>
                    {/* Mark as posted directly */}
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => handleMarkAsPosted(comp.id)}
                      className="flex-1 border-gray-700 text-gray-400 hover:text-white flex items-center gap-2 justify-center text-xs"
                    >
                      <Share2 className="w-3 h-3" />
                      Mark as Posted
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
