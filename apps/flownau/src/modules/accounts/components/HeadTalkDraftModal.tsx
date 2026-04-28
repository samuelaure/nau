'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, CheckCircle2, Loader2, Mic, Hash, AlignLeft } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import { cn } from '@/modules/shared/utils'

interface HeadTalkCreative {
  hook: string
  body: string
  cta: string
  caption: string
  hashtags: string[]
}

interface Post {
  id: string
  status: string
  ideaText: string | null
  creative: unknown
  caption: string | null
  hashtags: string[]
}

interface HeadTalkDraftModalProps {
  post: Post
  onClose: () => void
  onMarkedPosted: () => void
  onVideoUploaded: (videoUrl: string) => void
}

function parseCreative(creative: unknown): HeadTalkCreative | null {
  if (!creative || typeof creative !== 'object') return null
  const c = creative as Record<string, unknown>
  if (typeof c.hook !== 'string') return null
  return {
    hook: c.hook as string,
    body: typeof c.body === 'string' ? c.body : '',
    cta: typeof c.cta === 'string' ? c.cta : '',
    caption: typeof c.caption === 'string' ? c.caption : '',
    hashtags: Array.isArray(c.hashtags) ? (c.hashtags as string[]) : [],
  }
}

export default function HeadTalkDraftModal({
  post,
  onClose,
  onMarkedPosted,
  onVideoUploaded,
}: HeadTalkDraftModalProps) {
  const creative = parseCreative(post.creative)
  const caption = post.caption ?? creative?.caption ?? ''
  const hashtags = post.hashtags?.length ? post.hashtags : creative?.hashtags ?? []

  const [tab, setTab] = useState<'script' | 'caption'>('script')
  const [uploading, setUploading] = useState(false)
  const [marking, setMarking] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function uploadVideo(file: File) {
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/posts/${post.id}/upload-video`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      toast.success('Video uploaded — ready to publish on schedule')
      onVideoUploaded(data.videoUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function markPosted() {
    setMarking(true)
    try {
      const res = await fetch(`/api/posts/${post.id}/mark-posted`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed')
      }
      toast.success('Marked as posted')
      onMarkedPosted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark as posted')
    } finally {
      setMarking(false)
    }
  }

  const isPublished = post.status === 'PUBLISHED'
  const hasVideo = post.status === 'RENDERED_PENDING' || post.status === 'SCHEDULED' || post.status === 'PUBLISHED'

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-gray-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Mic size={16} className="text-accent" />
            <span className="font-semibold text-white">Head Talk Draft</span>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              isPublished ? 'bg-gray-700 text-gray-400' :
              hasVideo ? 'bg-purple-900/60 text-purple-300' :
              post.status === 'DRAFT_APPROVED' ? 'bg-green-900/60 text-green-400' :
              'bg-orange-900/60 text-orange-400'
            )}>
              {post.status.replace(/_/g, ' ')}
            </span>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Idea */}
        {post.ideaText && (
          <div className="px-6 pt-4 pb-0">
            <p className="text-xs text-text-secondary uppercase tracking-widest mb-1">Topic</p>
            <p className="text-sm text-white/70 italic">"{post.ideaText}"</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/5 px-6 mt-4">
          {(['script', 'caption'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 -mb-px text-sm border-b-2 transition-all capitalize',
                tab === t
                  ? 'text-accent border-accent font-semibold'
                  : 'text-text-secondary border-transparent hover:text-white',
              )}
            >
              {t === 'script' ? <span className="flex items-center gap-1.5"><AlignLeft size={13} />Script</span> : <span className="flex items-center gap-1.5"><Hash size={13} />Caption</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'script' && creative ? (
            <div className="flex flex-col gap-6">
              {/* Hook */}
              <div>
                <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">Hook</p>
                <p className="text-white leading-relaxed text-base font-medium">{creative.hook}</p>
              </div>

              {/* Body */}
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Body</p>
                <div className="text-white/85 leading-relaxed text-base whitespace-pre-line">{creative.body}</div>
              </div>

              {/* CTA */}
              <div>
                <p className="text-xs font-semibold text-accent/70 uppercase tracking-widest mb-2">Call to Action</p>
                <p className="text-white/85 leading-relaxed text-base">{creative.cta}</p>
              </div>
            </div>
          ) : tab === 'script' && !creative ? (
            <p className="text-text-secondary text-sm">No script generated yet.</p>
          ) : null}

          {tab === 'caption' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Caption</p>
                <p className="text-white/85 leading-relaxed text-sm whitespace-pre-line">{caption || '—'}</p>
              </div>
              {hashtags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Hashtags</p>
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((h) => (
                      <span key={h} className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1 text-text-secondary">
                        #{h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isPublished && (
          <div className="border-t border-white/5 px-6 py-4 flex flex-col gap-3">

            {/* Upload drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file) uploadVideo(file)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'w-full border-2 border-dashed rounded-xl py-5 flex flex-col items-center gap-2 cursor-pointer transition-colors',
                dragOver ? 'border-accent bg-accent/5' : 'border-white/10 hover:border-white/20',
                uploading && 'pointer-events-none opacity-60',
              )}
            >
              {uploading ? (
                <Loader2 size={20} className="text-accent animate-spin" />
              ) : hasVideo ? (
                <CheckCircle2 size={20} className="text-green-400" />
              ) : (
                <Upload size={20} className="text-text-secondary" />
              )}
              <p className="text-sm text-text-secondary">
                {uploading ? 'Uploading…' : hasVideo ? 'Video uploaded — click to replace' : 'Drop video here or click to upload'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideo(f) }}
              />
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-text-secondary"
              >
                Close
              </Button>
              <Button
                onClick={markPosted}
                disabled={marking}
                variant="outline"
              >
                {marking ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <CheckCircle2 size={14} className="mr-1.5" />}
                Mark as Posted
              </Button>
            </div>
          </div>
        )}

        {isPublished && (
          <div className="border-t border-white/5 px-6 py-4 flex justify-end">
            <Button variant="ghost" onClick={onClose} className="text-text-secondary">Close</Button>
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
