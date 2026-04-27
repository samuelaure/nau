import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ingestAccount } from '../lib/api'
import { RefreshCw, Database, Loader } from 'lucide-react'

interface ProfileActionsBarProps {
  username: string
}

export const ProfileActionsBar = ({ username }: ProfileActionsBarProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [scrapeLimit, setScrapeLimit] = React.useState<number>(50)

  const ingestMutation = useMutation({
    mutationFn: ingestAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', username] })
      navigate(`/progress?username=${username}`)
    },
  })

  const handleUpdateSync = () => {
    ingestMutation.mutate({ username, limit: 50, updateSync: true })
  }

  const handleScrape = (e: React.FormEvent) => {
    e.preventDefault()
    ingestMutation.mutate({ username, limit: scrapeLimit })
  }

  return (
    <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <button
        className="btn-secondary"
        onClick={handleUpdateSync}
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
        }}
        title="Update Sync: Check for new posts"
      >
        {ingestMutation.isPending ? (
          <>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Syncing...
          </>
        ) : (
          <>
            <RefreshCw size={16} /> Update Sync
          </>
        )}
      </button>

      <form
        onSubmit={handleScrape}
        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
      >
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
            cursor: ingestMutation.isPending ? 'not-allowed' : 'auto',
          }}
        />
        <button
          type="submit"
          className="btn-secondary"
          disabled={ingestMutation.isPending}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            borderRadius: '4px',
            background: '#444',
            color: 'white',
            border: 'none',
            cursor: ingestMutation.isPending ? 'not-allowed' : 'pointer',
            opacity: ingestMutation.isPending ? 0.6 : 1,
          }}
          title="Scrape historical posts"
        >
          {ingestMutation.isPending ? (
            <>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Scraping...
            </>
          ) : (
            <>
              <Database size={16} /> Scrape
            </>
          )}
        </button>
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
