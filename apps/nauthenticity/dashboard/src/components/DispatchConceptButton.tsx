import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, Loader2, Check } from 'lucide-react'
import { dispatchConceptById } from '../lib/api'

interface Props {
  conceptId: string
  status: string
  /** Query keys to invalidate after a successful dispatch. */
  invalidateKeys?: unknown[][]
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#d29922',
  dispatching: '#58a6ff',
  consumed: '#3fb950',
}

export const DispatchConceptButton = ({ conceptId, status, invalidateKeys }: Props) => {
  const qc = useQueryClient()
  const [localStatus, setLocalStatus] = useState(status)

  const dispatch = useMutation({
    mutationFn: () => dispatchConceptById(conceptId),
    onMutate: () => setLocalStatus('dispatching'),
    onSuccess: () => {
      setLocalStatus('consumed')
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }))
    },
    onError: () => setLocalStatus(status),
  })

  const current = dispatch.isPending ? 'dispatching' : localStatus
  const color = STATUS_COLORS[current] ?? '#8b949e'

  if (current === 'consumed') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
          background: `${color}1a`, border: `1px solid ${color}55`, color,
          alignSelf: 'flex-start',
        }}
      >
        <Check size={11} /> Consumed
      </span>
    )
  }

  if (current === 'dispatching') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
          background: `${color}1a`, border: `1px solid ${color}55`, color,
          alignSelf: 'flex-start',
        }}
      >
        <Loader2 size={11} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Dispatching…
      </span>
    )
  }

  return (
    <button
      onClick={() => dispatch.mutate()}
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
  )
}
