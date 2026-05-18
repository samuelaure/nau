import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getVoicenote } from '../lib/api'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { DispatchConceptButton } from '../components/DispatchConceptButton'

export const VoicenoteView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo: string | null = (location.state as any)?.backTo ?? null

  const { data, isLoading } = useQuery({
    queryKey: ['voicenote', id],
    queryFn: () => getVoicenote(id!),
    enabled: !!id,
  })

  if (isLoading) return <div>Loading…</div>
  if (!data) return <div>Voicenote not found</div>

  const { voicenote, concepts } = data

  return (
    <div className="fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, fontSize: '0.9rem' }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>
          Captured {formatDistanceToNow(new Date(voicenote.createdAt), { addSuffix: true })}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2rem' }}>
        {/* Left: source content (transcription) */}
        <div>
          <h2 style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
            Transcription
          </h2>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.1rem 1.25rem' }}>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#c9d1d9', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {voicenote.cleanTranscription}
            </p>
          </div>
        </div>

        {/* Right: sections */}
        <div>
          <CollapsibleSection label="Synthesis" defaultOpen>
            {voicenote.synthesis ? (
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#c9d1d9', lineHeight: 1.6 }}>{voicenote.synthesis}</p>
            ) : (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#8b949e' }}>No synthesis yet.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection label="Source Concepts" count={concepts.length} defaultOpen>
            {concepts.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#8b949e' }}>No source concepts derived yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {concepts.map((c) => (
                  <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9d1d9', lineHeight: 1.6 }}>{c.content}</p>
                    <DispatchConceptButton conceptId={c.id} status={c.status} invalidateKeys={[['voicenote', id]]} />
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}
