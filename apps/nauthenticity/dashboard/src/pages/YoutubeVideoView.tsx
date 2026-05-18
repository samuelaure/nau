import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ExternalLink, RefreshCw, Loader2 } from 'lucide-react'
import { getYoutubeVideo, retryYoutubeVideo } from '../lib/api'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { DispatchConceptButton } from '../components/DispatchConceptButton'
import { StatusBadge } from '../components/StatusBadge'

export const YoutubeVideoView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo: string | null = (location.state as any)?.backTo ?? null
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['youtube-video', id],
    queryFn: () => getYoutubeVideo(id!),
    enabled: !!id,
  })

  const retry = useMutation({
    mutationFn: () => retryYoutubeVideo(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['youtube-video', id] }),
  })

  if (isLoading) return <div>Loading…</div>
  if (!data) return <div>Video not found</div>

  const { video, concepts } = data

  return (
    <div className="fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, fontSize: '0.9rem' }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#58a6ff', textDecoration: 'none', fontSize: '0.85rem' }}
        >
          Open on YouTube <ExternalLink size={13} />
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2rem' }}>
        {/* Left: embed + metadata */}
        <div>
          <div style={{ aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <iframe
              src={`https://www.youtube.com/embed/${video.videoId}`}
              title={video.title ?? 'YouTube video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{video.title ?? 'Untitled video'}</h1>
            {video.channelName && <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>{video.channelName}</span>}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <StatusBadge status={video.status} />
              {video.failureReason && (
                <span style={{ fontSize: '0.75rem', color: '#f85149' }}>
                  {video.failureReason === 'duration_limit_exceeded' ? 'Video exceeds 60-minute limit' : video.failureReason}
                </span>
              )}
              {video.status === 'failed' && (
                <button
                  onClick={() => retry.mutate()}
                  disabled={retry.isPending}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                    background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)',
                    color: '#58a6ff', cursor: 'pointer',
                  }}
                >
                  {retry.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: sections */}
        <div>
          <CollapsibleSection label="Synthesis" defaultOpen>
            {video.synthesis ? (
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#c9d1d9', lineHeight: 1.6 }}>{video.synthesis}</p>
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
                    <DispatchConceptButton conceptId={c.id} status={c.status} invalidateKeys={[['youtube-video', id]]} />
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection label="Transcript" defaultOpen={false}>
            {video.transcript ? (
              <pre style={{ margin: 0, fontSize: '0.8rem', color: '#c9d1d9', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.55, maxHeight: '320px', overflowY: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>{video.transcript}</pre>
            ) : (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#8b949e' }}>No transcript available.</p>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}
