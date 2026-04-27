import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBrandOwnedProfiles, getAccount, getMediaUrl } from '../lib/api';
import { Database, ArrowRight } from 'lucide-react';
import { PostGrid } from '../components/PostGrid';

export const BrandContentView = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const [selectedUsername, setSelectedUsername] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<'recent' | 'oldest' | 'likes' | 'comments'>('recent');

  // Fetch owned profiles for this brand
  const { data: ownedProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ['owned-profiles', brandId],
    queryFn: () => getBrandOwnedProfiles(brandId!),
    enabled: !!brandId,
  });

  // Fetch selected profile's posts
  const {
    data: selectedAccount,
    isLoading: loadingAccount,
  } = useQuery({
    queryKey: ['account', selectedUsername],
    queryFn: () => getAccount(selectedUsername!),
    enabled: !!selectedUsername,
  });

  if (loadingProfiles) return <div>Loading Brand Profiles...</div>;

  // Show profile detail view if selected
  if (selectedUsername && selectedAccount) {
    return (
      <div className="fade-in">
        <button
          onClick={() => setSelectedUsername(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#58a6ff',
            cursor: 'pointer',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
            fontWeight: 500,
          }}
        >
          &larr; Back to Profiles
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <img
            src={getMediaUrl(selectedAccount.profileImageUrl) || 'https://via.placeholder.com/100'}
            alt={selectedAccount.username}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: '2px solid var(--border)',
            }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>@{selectedAccount.username}</h1>
            <span style={{ color: 'var(--text-secondary)' }}>
              {selectedAccount._count?.posts || 0} posts
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="likes">Most Likes</option>
            <option value="comments">Most Comments</option>
          </select>
        </div>

        {loadingAccount ? <div>Loading posts...</div> : <PostGrid posts={selectedAccount.posts} sort={sort} />}
      </div>
    );
  }

  // Show profiles grid
  return (
    <div className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>Social Profiles</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          {ownedProfiles?.length === 0
            ? 'No social profiles linked yet. Create one in flownau to get started.'
            : `${ownedProfiles?.length} profile(s) ready for content management.`}
        </p>
      </div>

      {ownedProfiles && ownedProfiles.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {ownedProfiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => setSelectedUsername(profile.username)}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#58a6ff';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 10px rgba(88, 166, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <img
                src={getMediaUrl(profile.profileImageUrl) || 'https://via.placeholder.com/150'}
                alt={profile.username}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: '2px solid var(--border)',
                }}
              />
              <div>
                <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>@{profile.username}</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {profile._count?.posts || 0} posts
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#8b949e' }}>
                  Last: {new Date(profile.lastScrapedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  background: '#58a6ff',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                View Content <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            background: 'var(--card-bg)',
            borderRadius: '12px',
            border: '1px dashed var(--border)',
            color: '#8b949e',
          }}
        >
          <Database size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p style={{ margin: 0 }}>No profiles yet. Sync from flownau or add manually.</p>
        </div>
      )}
    </div>
  );
};
