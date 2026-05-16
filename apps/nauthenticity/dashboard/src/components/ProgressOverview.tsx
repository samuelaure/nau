import { useQuery } from '@tanstack/react-query'
import { getProfileProgress } from '../lib/api'

interface ProgressOverviewProps {
  username: string
  postCount: number
}

const STAGE_ORDER = ['pending', 'downloading', 'optimizing', 'computing', 'ready', 'failed']
const STAGE_LABELS: Record<string, string> = {
  pending: 'Pending',
  downloading: 'Downloading',
  optimizing: 'Optimizing',
  computing: 'Computing',
  ready: 'Ready',
  failed: 'Failed',
}
const STAGE_COLORS: Record<string, string> = {
  pending: '#8b949e',
  downloading: '#58a6ff',
  optimizing: '#d29922',
  computing: '#bc8cff',
  ready: '#3fb950',
  failed: '#f85149',
}

export const ProgressOverview = ({ username, postCount }: ProgressOverviewProps) => {
  const { data: progress } = useQuery({
    queryKey: ['progress', username],
    queryFn: () => getProfileProgress(username),
    refetchInterval: (query) => {
      const phase = query.state.data?.summary?.phase
      return phase && phase !== 'finished' ? 3000 : false
    },
    enabled: postCount > 0,
  })

  const phase = progress?.summary?.phase
  if (!phase || phase === 'finished') return null

  const counts: Record<string, number> = {}
  for (const post of progress.posts) {
    const s = (post as any).status ?? 'pending'
    counts[s] = (counts[s] ?? 0) + 1
  }

  const activeStages = STAGE_ORDER.filter((s) => counts[s] && counts[s] > 0)
  if (activeStages.length === 0) return null

  return (
    <div style={{ marginBottom: '1.5rem', padding: '0.9rem 1.1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.5rem', alignItems: 'center' }}>
      <span style={{ fontSize: '0.78rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
        Processing · {phase}
      </span>
      {activeStages.map((stage) => (
        <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLORS[stage], flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontSize: '0.82rem', color: STAGE_COLORS[stage], fontWeight: 600 }}>{counts[stage]}</span>
          <span style={{ fontSize: '0.82rem', color: '#8b949e' }}>{STAGE_LABELS[stage]}</span>
        </div>
      ))}
    </div>
  )
}
