'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import Modal from '@/modules/shared/components/Modal'
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
  Send,
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

interface SocialProfile {
  id: string
  username: string | null
  platform: string
  profileImage: string | null
  accessToken: string | null
}

export default function AccountCompositions({ brandId }: { brandId: string }) {
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [publishInProgress, setPublishInProgress] = useState(false)

  const fetchCompositions = async () => {
    try {
      const [composRes, profileRes] = await Promise.all([
        fetch(`/api/compositions?brandId=${brandId}`),
        fetch(`/api/brands/${brandId}/social-profiles`),
      ])
      const compData = await composRes.json()
      const profileData = await profileRes.json()
      // Filter to post-render statuses only — pool handles DRAFT/APPROVED
      const rendered = (compData.compositions ?? []).filter((c: Composition) =>
        ['RENDERING', 'RENDERED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED'].includes(c.status),
      )
      setCompositions(rendered)
      setSocialProfiles(profileData.profiles ?? [])
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

  const handlePublish = (id: string) => {
    setPublishingId(id)
    setSelectedProfiles([])
    setPublishModalOpen(true)
  }

  const toggleProfile = (profileId: string) => {
    setSelectedProfiles((prev) =>
      prev.includes(profileId) ? prev.filter((p) => p !== profileId) : [...prev, profileId],
    )
  }

  const confirmPublish = async () => {
    if (selectedProfiles.length === 0) {
      toast.error('Select at least one profile')
      return
    }
    setPublishInProgress(true)
    try {
      const res = await fetch(`/api/compositions/${publishingId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds: selectedProfiles }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Publish failed')
      }
      toast.success('Published to selected profiles')
      setPublishModalOpen(false)
      setPublishingId(null)
      await fetchCompositions()
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish')
    } finally {
      setPublishInProgress(false)
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
                  <div className="shrink-0 flex gap-2">
                    <Button
                      disabled={busy || publishingId === comp.id}
                      onClick={() => handlePublish(comp.id)}
                      className="bg-accent hover:bg-accent/80 gap-1.5 text-xs"
                    >
                      {publishingId === comp.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      Publish
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => handleMarkPublished(comp.id)}
                      className="bg-green-800 hover:bg-green-700 gap-1.5 text-xs"
                    >
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      Mark published
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Publish Modal */}
      <Modal isOpen={publishModalOpen} onClose={() => { setPublishModalOpen(false); setPublishingId(null) }}>
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-accent">
            <Send size={36} />
          </div>
          <h2 className="text-3xl font-heading font-bold mb-3">Publish Composition</h2>
          <p className="text-text-secondary text-base max-w-[320px] mx-auto">
            Select the social profiles where you want to publish this content.
          </p>
        </div>

        <div className="space-y-3 mb-8 max-h-64 overflow-y-auto">
          {socialProfiles.length === 0 ? (
            <p className="text-center text-text-secondary text-sm py-8">
              No social profiles added yet. Add profiles in the Publishing Channels section first.
            </p>
          ) : (
            socialProfiles.map((profile) => (
              <label
                key={profile.id}
                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedProfiles.includes(profile.id)}
                  onChange={() => toggleProfile(profile.id)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">@{profile.username ?? 'unnamed'}</p>
                  <p className="text-xs text-text-secondary capitalize">
                    {profile.accessToken ? '✓ Authorized' : '⚠ Needs authorization'}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => { setPublishModalOpen(false); setPublishingId(null) }}
            disabled={publishInProgress}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmPublish}
            disabled={publishInProgress || selectedProfiles.length === 0}
            className="flex-1 bg-accent hover:bg-accent/80"
          >
            {publishInProgress ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Publishing…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Publish to {selectedProfiles.length} {selectedProfiles.length === 1 ? 'profile' : 'profiles'}
              </>
            )}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
