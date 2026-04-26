import { useQuery, useMutation } from '@tanstack/react-query';
import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProfile, getMediaUrl, API_URL, ingestAccount } from '../lib/api';
import { ChevronRight, Download, RefreshCw, Database } from 'lucide-react';
import { PostGrid } from '../components/PostGrid';

export const ProfileView = () => {
  const { username } = useParams<{ username: string }>();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => getProfile(username!),
  });

  const [sort, setSort] = React.useState<'recent' | 'oldest' | 'likes' | 'comments'>('recent');
  const [scrapeLimit, setScrapeLimit] = React.useState<number>(50);
  const navigate = useNavigate();
  const ingestMutation = useMutation({
    mutationFn: ingestAccount,
    onSuccess: () => navigate(`/progress?username=${username}`),
  });

  if (isLoading) return <div>Loading...</div>;
  if (!profile) return <div>Profile not found</div>;

  return (
    <div className="fade-in">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '1.5rem',
          color: 'var(--text-secondary)',
          fontSize: '14px',
        }}
      >
        <Link to="/profiles" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Social Profiles
        </Link>
        <ChevronRight size={14} />
        <span>@{profile.username}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <img
          src={getMediaUrl(profile.profileImageUrl ?? undefined) || 'https://via.placeholder.com/100'}
          alt={profile.username}
          style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid var(--border)' }}
        />
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>@{profile.username}</h1>
          <span style={{ color: 'var(--text-secondary)' }}>
            Last scraped: {new Date(profile.lastScrapedAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          style={{ padding: '0.5rem', borderRadius: '4px', background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <option value="recent">Most Recent</option>
          <option value="oldest">Oldest First</option>
          <option value="likes">Most Likes</option>
          <option value="comments">Most Comments</option>
        </select>

        <a
          href={`${API_URL}/accounts/${username}/export/txt`}
          download
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '4px', background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          <Download size={16} /> Export to TXT
        </a>
        <button
          onClick={() => ingestMutation.mutate({ username: profile.username, limit: 50, updateSync: true })}
          disabled={ingestMutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '4px', background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          <RefreshCw size={16} /> Update Sync
        </button>
        <form
          onSubmit={(e) => { e.preventDefault(); ingestMutation.mutate({ username: profile.username, limit: scrapeLimit }); }}
          style={{ display: 'flex', gap: '0.5rem' }}
        >
          <input
            type="number"
            value={scrapeLimit}
            onChange={(e) => setScrapeLimit(Number(e.target.value))}
            min={1} max={10000}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '4px', width: '80px' }}
          />
          <button
            type="submit"
            disabled={ingestMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '4px', background: '#444', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            <Database size={16} /> Scrape
          </button>
        </form>
      </div>

      <PostGrid posts={profile.posts} sort={sort} />
    </div>
  );
};
