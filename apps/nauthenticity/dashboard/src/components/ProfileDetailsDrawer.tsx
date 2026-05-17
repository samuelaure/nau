import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, RefreshCw, Zap } from 'lucide-react'
import { getProfileSynthesis, getProfileSourceConcepts, generateProfileIntelligence, dispatchSourceConcept } from '../lib/api'

interface ProfileDetailsDrawerProps {
  socialProfileId: string
  username: string
  brandId?: string
  showSourceConcepts: boolean
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  pending:  '#d29922',
  consumed: '#3fb950',
}

export const ProfileDetailsDrawer = ({ socialProfileId, username, brandId, showSourceConcepts, onClose }: ProfileDetailsDrawerProps) => {
  const queryClient = useQueryClient()

  const { data: synthesis, isLoading: loadingSynthesis } = useQuery({
    queryKey: ['profile-synthesis', socialProfileId],
    queryFn: () => getProfileSynthesis(socialProfileId),
    enabled: !!socialProfileId,
  })

  const { data: concepts, isLoading: loadingConcepts } = useQuery({
    queryKey: ['profile-source-concepts', socialProfileId],
    queryFn: () => getProfileSourceConcepts(socialProfileId),
    enabled: !!socialProfileId && showSourceConcepts,
  })

  const regenerate = useMutation({
    mutationFn: () => generateProfileIntelligence(socialProfileId, brandId!),
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['profile-synthesis', socialProfileId] })
        queryClient.invalidateQueries({ queryKey: ['profile-source-concepts', socialProfileId] })
      }, 3000)
    },
  })

  const dispatch = useMutation({
    mutationFn: ({ itemType, itemId }: { itemType: 'post' | 'profile' | 'voicenote' | 'youtube' | 'blog'; itemId: string }) =>
      dispatchSourceConcept(brandId!, itemType, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile-source-concepts', socialProfileId] }),
  })

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1001,
        width: 'min(480px, 100vw)',
        background: '#0d1117',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: '#0d1117', zIndex: 1 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>@{username}</h2>
            <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>Profile details</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Regenerate button */}
          <button
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending || !brandId}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.6rem 1rem', borderRadius: '8px', width: '100%',
              background: regenerate.isPending ? 'rgba(88,166,255,0.05)' : 'rgba(88,166,255,0.1)',
              border: '1px solid rgba(88,166,255,0.3)', color: '#58a6ff',
              cursor: regenerate.isPending ? 'default' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
            }}
          >
            <RefreshCw size={14} style={{ animation: regenerate.isPending ? 'spin 1s linear infinite' : 'none' }} />
            {regenerate.isPending ? 'Regenerating…' : 'Refresh Intelligence'}
          </button>
          {regenerate.isSuccess && (
            <p style={{ margin: '-0.5rem 0 0', fontSize: '0.75rem', color: '#3fb950', textAlign: 'center' }}>
              Regeneration queued — results will appear shortly.
            </p>
          )}

          {/* Synthesis */}
          <section>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
              Profile Synthesis
            </h3>
            {loadingSynthesis ? (
              <p style={{ color: '#8b949e', fontSize: '0.875rem' }}>Loading…</p>
            ) : !synthesis ? (
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border)', borderRadius: '8px', color: '#8b949e', fontSize: '0.875rem' }}>
                No synthesis yet. Click "Refresh Intelligence" to generate one.
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#c9d1d9', lineHeight: 1.65 }}>{synthesis.content}</p>
                <span style={{ fontSize: '0.72rem', color: '#6e7681' }}>
                  Generated from {synthesis.postCountAtGeneration} posts · {new Date(synthesis.generatedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </section>

          {/* Source Concepts — InspoBase only */}
          {showSourceConcepts && (
            <section>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
                Source Concepts
              </h3>
              {loadingConcepts ? (
                <p style={{ color: '#8b949e', fontSize: '0.875rem' }}>Loading…</p>
              ) : !concepts || concepts.length === 0 ? (
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border)', borderRadius: '8px', color: '#8b949e', fontSize: '0.875rem' }}>
                  No source concepts yet. Click "Refresh Intelligence" to generate them.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {concepts.map((c) => (
                    <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9d1d9', lineHeight: 1.6 }}>{c.content}</p>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 7px', borderRadius: '100px', background: c.link === 'profile' ? 'rgba(188,140,255,0.15)' : 'rgba(88,166,255,0.15)', color: c.link === 'profile' ? '#bc8cff' : '#58a6ff', border: `1px solid ${c.link === 'profile' ? '#bc8cff44' : '#58a6ff44'}` }}>
                          {c.link === 'profile' ? 'profile' : 'post'}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 7px', borderRadius: '100px', color: STATUS_COLORS[c.status] ?? '#8b949e', background: 'rgba(0,0,0,0.2)', border: `1px solid ${STATUS_COLORS[c.status] ?? '#8b949e'}44` }}>
                          {c.status}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#6e7681', marginLeft: 'auto' }}>
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {brandId && (
                        <button
                          onClick={() => dispatch.mutate({ itemType: c.link === 'profile' ? 'profile' : 'post', itemId: c.id })}
                          disabled={dispatch.isPending}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start',
                            padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                            background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)',
                            color: '#3fb950', cursor: 'pointer',
                          }}
                        >
                          <Zap size={11} /> Create Content
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>,
    document.body,
  )
}
