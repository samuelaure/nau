import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ingestAccount } from '../lib/api'
import { RefreshCw, Download, Loader } from 'lucide-react'

interface ProfileActionsBarProps {
  username: string
  postCount?: number
}

export const ProfileActionsBar = ({ username, postCount = 0 }: ProfileActionsBarProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [scrapeLimit, setScrapeLimit] = React.useState<number>(50)
  const isFirstTime = postCount === 0

  const ingestMutation = useMutation({
    mutationFn: ingestAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', username] })
      navigate(`/progress?username=${username}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isFirstTime) {
      ingestMutation.mutate({ username, limit: scrapeLimit })
    } else {
      ingestMutation.mutate({ username, limit: 50, updateSync: true })
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {isFirstTime && (
        <input
          type="number"
          value={scrapeLimit}
          onChange={(e) => setScrapeLimit(Number(e.target.value))}
          min={1}
          max={10000}
          disabled={ingestMutation.isPending}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '0.5rem',
            borderRadius: '4px',
            width: '80px',
          }}
        />
      )}
      <button
        type="submit"
        disabled={ingestMutation.isPending}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          borderRadius: '4px',
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          cursor: ingestMutation.isPending ? 'not-allowed' : 'pointer',
          opacity: ingestMutation.isPending ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {ingestMutation.isPending ? (
          <>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
            {isFirstTime ? 'Downloading...' : 'Syncing...'}
          </>
        ) : isFirstTime ? (
          <><Download size={16} /> Download Profile</>
        ) : (
          <><RefreshCw size={16} /> Sync Profile</>
        )}
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  )
}
