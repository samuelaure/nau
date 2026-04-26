'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Film,
  Play,
  Mic,
  LayoutGrid,
  ImageIcon,
  Clock,
  AlertCircle,
} from 'lucide-react'

const FORMAT_ICON: Record<string, React.ElementType> = {
  reel: Film,
  trial_reel: Play,
  head_talk: Mic,
  carousel: LayoutGrid,
  single_image: ImageIcon,
}

const FORMAT_LABEL: Record<string, string> = {
  reel: 'Reel',
  trial_reel: 'Trial Reel',
  head_talk: 'Head Talk',
  carousel: 'Carousel',
  single_image: 'Single Image',
}

export default function AccountFinalReview({ brandId }: { brandId: string }) {
  const [compositions, setCompositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const fetchCompositions = async () => {
    try {
      const res = await fetch(`/api/compositions?brandId=${brandId}&status=RENDERED`)
      const data = await res.json()
      setCompositions(data.compositions || [])
    } catch {
      toast.error('Failed to load rendered compositions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompositions()
  }, [brandId])

  const handleApprove = async (compositionId: string) => {
    setApprovingId(compositionId)
    try {
      const res = await fetch(`/api/compositions/${compositionId}/approve-post`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to approve')
      }
      toast.success('Approved for posting — publisher will pick it up on next run.')
      setCompositions((prev) => prev.filter((c) => c.id !== compositionId))
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve composition')
    } finally {
      setApprovingId(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-text-secondary">Loading rendered compositions...</div>
    )
  }

  if (compositions.length === 0) {
    return (
      <div className="text-center py-16 text-text-secondary flex flex-col items-center gap-3">
        <CheckCircle2 size={40} className="opacity-30" />
        <p>No compositions awaiting final review.</p>
        <p className="text-xs opacity-60">
          Rendered compositions with <strong>Auto-Post OFF</strong> will appear here for manual
          approval.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-heading font-semibold">Final Review</h3>
        <span className="text-sm text-text-secondary">
          {compositions.length} composition{compositions.length !== 1 ? 's' : ''} awaiting approval
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {compositions.map((comp) => (
          <CompositionReviewCard
            key={comp.id}
            comp={comp}
            onApprove={handleApprove}
            approving={approvingId === comp.id}
          />
        ))}
      </div>
    </div>
  )
}

function CompositionReviewCard({
  comp,
  onApprove,
  approving,
}: {
  comp: any
  onApprove: (id: string) => void
  approving: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const FormatIcon = FORMAT_ICON[comp.format] || Film

  const videoUrl = comp.videoUrl || comp.renderJob?.outputUrl
  const isCarousel = comp.format === 'carousel'
  const carouselImages: string[] = comp.renderJob?.outputUrls || []

  const scheduledAt = comp.scheduledAt ? new Date(comp.scheduledAt) : null

  const togglePlay = () => {
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
      setPlaying(false)
    } else {
      videoRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <Card className="bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* Media Preview */}
        <div className="md:w-64 shrink-0 bg-black flex items-center justify-center min-h-[180px] relative">
          {isCarousel && carouselImages.length > 0 ? (
            <div className="flex gap-1 p-2 overflow-x-auto w-full">
              {carouselImages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Slide ${i + 1}`}
                  className="h-40 w-auto object-cover rounded shrink-0"
                />
              ))}
            </div>
          ) : videoUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                src={videoUrl}
                className="max-h-64 w-full object-contain"
                onEnded={() => setPlaying(false)}
                controls={false}
                preload="metadata"
              />
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition"
              >
                {playing ? (
                  <span className="text-white text-3xl">⏸</span>
                ) : (
                  <Play size={40} className="text-white" />
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-600 p-8">
              <AlertCircle size={32} />
              <span className="text-xs text-center">No preview available</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <FormatIcon size={16} className="text-cyan-400" />
              <span className="text-sm font-semibold text-cyan-400">
                {FORMAT_LABEL[comp.format] || comp.format}
              </span>
              <span className="text-[10px] bg-cyan-900/40 text-cyan-300 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
                RENDERED
              </span>
            </div>
            {scheduledAt && (
              <div className="flex items-center gap-1 text-xs text-text-secondary shrink-0">
                <Clock size={12} />
                <span>
                  {scheduledAt.toLocaleDateString()}{' '}
                  {scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>

          {comp.caption && <p className="text-sm text-gray-300 line-clamp-3">{comp.caption}</p>}

          {comp.hashtags?.length > 0 && (
            <p className="text-xs text-blue-400 line-clamp-2">
              {comp.hashtags.map((h: string) => `#${h}`).join(' ')}
            </p>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
            <Button
              onClick={() => onApprove(comp.id)}
              disabled={approving}
              className="flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              {approving ? 'Approving...' : 'Approve & Schedule Post'}
            </Button>
            <span className="text-xs text-text-secondary">
              This will authorize the publisher to post it at the scheduled time.
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
