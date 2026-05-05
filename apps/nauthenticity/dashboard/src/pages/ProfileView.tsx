import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getProfile, getMediaUrl, API_URL } from '../lib/api';
import { ChevronRight, Download } from 'lucide-react';
import { PostGrid } from '../components/PostGrid';
import { ProfileActionsBar } from '../components/ProfileActionsBar';

export const ProfileView = () => {
  const { username } = useParams<{ username: string }>();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => getProfile(username!),
  });

  const [sort, setSort] = React.useState<'recent' | 'oldest' | 'likes' | 'comments'>('recent');

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

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
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

        <ProfileActionsBar username={profile.username} postCount={profile.posts.length} />
      </div>

      <PostGrid posts={profile.posts} sort={sort} />
    </div>
  );
};
