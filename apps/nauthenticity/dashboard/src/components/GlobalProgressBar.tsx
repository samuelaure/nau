import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2, Activity } from 'lucide-react'
import { getQueueStatus } from '../lib/api'

const QUEUE_LABELS: Record<string, string> = {
  ingestion: 'Scraping',
  download: 'Downloading',
  optimization: 'Optimizing',
  compute: 'Computing',
}

export const GlobalProgressBar = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: queues } = useQuery({
    queryKey: ['queue-status'],
    queryFn: getQueueStatus,
    refetchInterval: 5000,
  })

  if (!queues) return null

  const activeQueues = (Object.entries(queues) as [string, { counts: { active: number } }][])
    .filter(([, m]) => m.counts.active > 0)
    .map(([name, m]) => ({ name, count: m.counts.active }))

  if (activeQueues.length === 0) return null

  const label = activeQueues.map((q) => `${QUEUE_LABELS[q.name] ?? q.name} (${q.count})`).join(' · ')

  const handleViewProgress = () => {
    navigate('/progress', { state: { from: location.pathname + location.search } })
  }

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.6rem 1.25rem',
      background: 'rgba(88,166,255,0.08)',
      borderBottom: '1px solid rgba(88,166,255,0.2)',
      marginBottom: '1.5rem',
      marginLeft: '-40px', marginRight: '-40px', marginTop: '-40px',
      paddingLeft: '40px', paddingRight: '40px', paddingTop: '0.6rem',
    }}>
      <Loader2 size={14} style={{ color: '#58a6ff', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
      <span style={{ fontSize: '0.82rem', color: '#58a6ff', fontWeight: 600, flexShrink: 0 }}>
        Processing
      </span>
      <span style={{ fontSize: '0.82rem', color: '#8b949e', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <button
        onClick={handleViewProgress}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0,
          padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
          background: 'rgba(88,166,255,0.15)', border: '1px solid rgba(88,166,255,0.3)',
          color: '#58a6ff', cursor: 'pointer',
        }}
      >
        <Activity size={12} /> View Progress
      </button>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
