import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getAccount, getProfileImageUrl } from '../lib/api'
import { ArrowLeft, RefreshCw, Info } from 'lucide-react'
import { PostGrid } from './PostGrid'
import { ScrapeModal } from './ScrapeModal'
import { ProgressOverview } from './ProgressOverview'
import { ProfileDetailsDrawer } from './ProfileDetailsDrawer'

interface ProfileDetailProps {
  backLabel: string
  backPath: string
  renderPostActions?: (post: any) => React.ReactNode
  showSourceConcepts?: boolean
}

export const ProfileDetail = ({ backLabel, backPath, renderPostActions, showSourceConcepts = false }: ProfileDetailProps) => {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const [sort, setSort] = React.useState<'recent' | 'oldest' | 'likes' | 'comments'>('recent')
  const [scrapeOpen, setScrapeOpen] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', username],
    queryFn: () => getAccount(username!),
    enabled: !!username,
  })

  if (!username) return null

  return (
    <div className="fade-in">
      <button
        onClick={() => navigate(backPath)}
        style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px', padding: 0, fontWeight: 500 }}
      >
        <ArrowLeft size={16} /> {backLabel}
      </button>

      {isLoading || !account ? (
        <div style={{ color: '#8b949e' }}>Loading @{username}...</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            <img
              src={getProfileImageUrl(account.profileImageUrl, account.platform || 'instagram')}
              alt={account.username}
              style={{ width: '72px', height: '72px', borderRadius: '50%', border: '2px solid var(--border)', backgroundColor: 'var(--bg-card)', padding: account.profileImageUrl ? '0' : '10px', objectFit: 'cover', flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1.75rem' }}>@{account.username}</h2>
              <span style={{ color: '#8b949e', fontSize: '0.9rem' }}>{account.posts?.length ?? 0} posts captured</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={() => setDetailsOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '8px', background: 'rgba(139,148,158,0.1)', border: '1px solid rgba(139,148,158,0.3)', color: '#8b949e', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
              >
                <Info size={14} /> Details
              </button>
              <button
                onClick={() => setScrapeOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '8px', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', color: '#3fb950', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
              >
                <RefreshCw size={14} /> Scrape
              </button>
            </div>
          </div>

          <ProgressOverview username={account.username} postCount={account.posts?.length ?? 0} />

          <div style={{ marginBottom: '1.5rem' }}>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              style={{ padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="likes">Most Likes</option>
              <option value="comments">Most Comments</option>
            </select>
          </div>

          {account.posts?.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#8b949e', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              No posts captured yet for this profile.
            </div>
          ) : renderPostActions ? (
            <div className="posts-grid">
              {[...account.posts].sort((a, b) => {
                if (sort === 'recent') return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
                if (sort === 'oldest') return new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime()
                if (sort === 'likes') return b.likes - a.likes
                if (sort === 'comments') return b.comments - a.comments
                return 0
              }).map((post: any) => (
                <div key={post.id} style={{ position: 'relative' }}>
                  <PostGrid posts={[post]} sort="recent" />
                  {renderPostActions(post)}
                </div>
              ))}
            </div>
          ) : (
            <PostGrid posts={account.posts} sort={sort} />
          )}
        </>
      )}

      {scrapeOpen && (
        <ScrapeModal username={username} onClose={() => setScrapeOpen(false)} />
      )}

      {detailsOpen && account && (
        <ProfileDetailsDrawer
          socialProfileId={account.id}
          username={account.username}
          showSourceConcepts={showSourceConcepts}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  )
}
