import { createPortal } from 'react-dom'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, RefreshCw, ChevronDown, ChevronRight, ScrollText } from 'lucide-react'
import { getProfileSynthesis, getProfileSourceConcepts, generateProfileIntelligence } from '../lib/api'
import { PromptsModal } from './PromptsModal'
import { DispatchConceptButton } from './DispatchConceptButton'

interface ProfileDetailsDrawerProps {
  socialProfileId: string
  username: string
  brandId?: string
  showSourceConcepts: boolean
  onClose: () => void
}

const SectionHeader = ({ label, count, open, onToggle }: { label: string; count?: number; open: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%',
      background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
      marginBottom: open ? '0.75rem' : 0,
    }}
  >
    {open ? <ChevronDown size={13} color="#6e7681" /> : <ChevronRight size={13} color="#6e7681" />}
    <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
      {label}
    </span>
    {count !== undefined && (
      <span style={{ fontSize: '0.7rem', color: '#6e7681', marginLeft: '0.25rem' }}>({count})</span>
    )}
  </button>
)

const STATUS_COLORS: Record<string, string> = {
  pending:  '#d29922',
  consumed: '#3fb950',
}

export const ProfileDetailsDrawer = ({ socialProfileId, username, brandId, showSourceConcepts, onClose }: ProfileDetailsDrawerProps) => {
  const queryClient = useQueryClient()
  const [synthOpen, setSynthOpen] = useState(true)
  const [profileConceptsOpen, setProfileConceptsOpen] = useState(true)
  const [postConceptsOpen, setPostConceptsOpen] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)

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
            <SectionHeader label="Profile Synthesis" open={synthOpen} onToggle={() => setSynthOpen(o => !o)} />
            {synthOpen && (
              loadingSynthesis ? (
                <p style={{ color: '#8b949e', fontSize: '0.875rem' }}>Loading…</p>
              ) : !synthesis ? (
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border)', borderRadius: '8px', color: '#8b949e', fontSize: '0.875rem' }}>
                  No synthesis yet. Click "Refresh Intelligence" to generate one.
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#c9d1d9', lineHeight: 1.65 }}>{synthesis.content}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: '#6e7681' }}>
                      Generated from {synthesis.postCountAtGeneration} posts · {new Date(synthesis.generatedAt).toLocaleDateString()}
                    </span>
                    {(synthesis as any).synthesisTrace && (
                      <button
                        onClick={() => setShowPrompts(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#6e7681', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <ScrollText size={11} /> Prompts
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </section>

          {/* Source Concepts — InspoBase only */}
          {showSourceConcepts && (() => {
            const profileConcepts = concepts?.filter(c => c.link === 'profile') ?? []
            const postConcepts = concepts?.filter(c => c.link === 'post') ?? []

            const ConceptCard = ({ c }: { c: typeof profileConcepts[0] }) => (
              <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9d1d9', lineHeight: 1.6 }}>{c.content}</p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 7px', borderRadius: '100px', color: STATUS_COLORS[c.status] ?? '#8b949e', background: 'rgba(0,0,0,0.2)', border: `1px solid ${STATUS_COLORS[c.status] ?? '#8b949e'}44` }}>
                    {c.status}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#6e7681', marginLeft: 'auto' }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {brandId && (
                  <DispatchConceptButton
                    conceptId={c.id}
                    status={c.status}
                    invalidateKeys={[['profile-source-concepts', socialProfileId]]}
                  />
                )}
              </div>
            )

            return (
              <>
                <section>
                  <SectionHeader label="Profile Source Concepts" count={profileConcepts.length} open={profileConceptsOpen} onToggle={() => setProfileConceptsOpen(o => !o)} />
                  {profileConceptsOpen && (
                    loadingConcepts ? (
                      <p style={{ color: '#8b949e', fontSize: '0.875rem' }}>Loading…</p>
                    ) : profileConcepts.length === 0 ? (
                      <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border)', borderRadius: '8px', color: '#8b949e', fontSize: '0.875rem' }}>
                        No profile-level concepts yet. Click "Refresh Intelligence" to generate them.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {profileConcepts.map(c => <ConceptCard key={c.id} c={c} />)}
                      </div>
                    )
                  )}
                </section>

                <section>
                  <SectionHeader label="Post Source Concepts" count={postConcepts.length} open={postConceptsOpen} onToggle={() => setPostConceptsOpen(o => !o)} />
                  {postConceptsOpen && (
                    loadingConcepts ? (
                      <p style={{ color: '#8b949e', fontSize: '0.875rem' }}>Loading…</p>
                    ) : postConcepts.length === 0 ? (
                      <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border)', borderRadius: '8px', color: '#8b949e', fontSize: '0.875rem' }}>
                        No post-level concepts yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {postConcepts.map(c => <ConceptCard key={c.id} c={c} />)}
                      </div>
                    )
                  )}
                </section>
              </>
            )
          })()}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {showPrompts && synthesis?.synthesisTrace && (
        <PromptsModal
          title={`@${username} · profile synthesis`}
          trace={(synthesis as any).synthesisTrace}
          onClose={() => setShowPrompts(false)}
        />
      )}
    </>,
    document.body,
  )
}
