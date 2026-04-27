import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useParams } from 'react-router-dom';
import { getBrandOwnedProfiles, getAccount, getProfileImageUrl } from '../lib/api';
import { Database } from 'lucide-react';
import { PostGrid } from '../components/PostGrid';
import { ProfileActionsBar } from '../components/ProfileActionsBar';
import { SocialProfileCard } from '../components/SocialProfileCard';

export const BrandContentView = () => {
  const { brandId } = useParams<{ brandId: string }>();
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
            src={getProfileImageUrl(selectedAccount.profileImageUrl, selectedAccount.platform || 'instagram')}
            alt={selectedAccount.username}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: '2px solid var(--border)',
              backgroundColor: 'var(--card-bg)',
              padding: selectedAccount.profileImageUrl ? '0' : '12px',
            }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>@{selectedAccount.username}</h1>
            <span style={{ color: 'var(--text-secondary)' }}>
              {selectedAccount._count?.posts || 0} posts
            </span>
          </div>
        </div>

        <ProfileActionsBar username={selectedUsername} />

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
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {ownedProfiles.map((profile) => (
            <SocialProfileCard
              key={profile.id}
              profile={profile}
              onSelect={setSelectedUsername}
            />
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
