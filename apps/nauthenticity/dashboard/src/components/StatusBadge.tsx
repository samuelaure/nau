interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'ready' | 'failed' | string;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: 'rgba(139,148,158,0.15)', color: '#8b949e', label: 'Pending' },
  processing: { bg: 'rgba(88,166,255,0.15)',  color: '#58a6ff', label: 'Processing…' },
  ready:      { bg: 'rgba(63,185,80,0.15)',   color: '#3fb950', label: 'Ready' },
  failed:     { bg: 'rgba(248,81,73,0.15)',   color: '#f85149', label: 'Failed' },
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '100px',
      fontSize: '0.72rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      background: s.bg,
      color: s.color,
    }}>
      {s.label}
    </span>
  )
}
