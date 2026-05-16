import React from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ingestAccount } from '../lib/api'
import { X, RefreshCw, Loader } from 'lucide-react'

interface ScrapeModalProps {
  username: string
  onClose: () => void
}

export const ScrapeModal = ({ username, onClose }: ScrapeModalProps) => {
  const queryClient = useQueryClient()
  const [limit, setLimit] = React.useState(50)

  const mutation = useMutation({
    mutationFn: ingestAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', username] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ username, limit })
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '320px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Scrape @{username}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem', color: '#c9d1d9' }}>
            Number of posts
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Number(e.target.value)))}
              min={1}
              max={10000}
              disabled={mutation.isPending}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              style={{ padding: '0.45rem 1rem', borderRadius: '6px', background: 'none', border: '1px solid var(--border)', color: '#8b949e', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1.1rem', borderRadius: '6px', background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: mutation.isPending ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: mutation.isPending ? 0.6 : 1 }}
            >
              {mutation.isPending ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Scraping…</> : <><RefreshCw size={14} /> Scrape</>}
            </button>
          </div>
        </form>

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>,
    document.body,
  )
}
