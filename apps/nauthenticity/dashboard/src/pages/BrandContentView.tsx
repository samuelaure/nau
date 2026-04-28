import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getBrandOwnedProfiles, getAccount, getProfileImageUrl } from '../lib/api';
import { Database, TrendingUp } from 'lucide-react';
import { PostGrid } from '../components/PostGrid';
import { ProfileActionsBar } from '../components/ProfileActionsBar';
import { SocialProfileCard } from '../components/SocialProfileCard';

export const BrandContentView = () => {
  const { brandId, username } = useParams<{ brandId: string; username?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedUsername = username || null;
  const [sort, setSort] = React.useState<'recent' | 'oldest' | 'likes' | 'comments'>('recent');

  const [usernameToLink, setUsernameToLink] = React.useState('');
  const [isLinking, setIsLinking] = React.useState(false);

  // Fetch owned profiles for this brand
  const { data: ownedProfiles, isLoading: loadingProfiles, refetch: refetchProfiles } = useQuery({
    queryKey: ['owned-profiles', brandId],
    queryFn: () => getBrandOwnedProfiles(brandId!),
    enabled: !!brandId,
  });

  const handleLinkProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameToLink.trim() || !brandId) return;
    setIsLinking(true);
    try {
      const workspaceId = location.pathname.match(/\/workspaces\/([^/]+)/)?.[1];
      // 1. Sync to nauthenticity
      await import('../lib/api').then(api => api.syncSocialProfile({
        username: usernameToLink.trim(),
        brandId,
        workspaceId,
      }));
      // 2. Sync to flownau
      await import('../lib/api').then(api => api.syncProfilesToFlownau(brandId));
      
      setUsernameToLink('');
      refetchProfiles();
    } catch (err) {
      console.error('Failed to link profile:', err);
      alert('Failed to link profile. Ensure the brand exists and is accessible.');
    } finally {
      setIsLinking(false);
    }
  };

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
          onClick={() => {
            const workspaceId = location.pathname.match(/\/workspaces\/([^/]+)/)?.[1];
            navigate(`/workspaces/${workspaceId}/brands/${brandId}/content`);
          }}
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

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <ProfileActionsBar username={selectedUsername} />
          <button
            onClick={() => navigate(`/progress?username=${selectedUsername}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              background: '#58a6ff',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <TrendingUp size={16} />
            Progress Overview
          </button>
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
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>Social Profiles</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {ownedProfiles?.length === 0
              ? 'No social profiles linked yet. Link one below.'
              : `${ownedProfiles?.length} profile(s) ready for content management.`}
          </p>
        </div>
        <form onSubmit={handleLinkProfile} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="@username"
            value={usernameToLink}
            onChange={(e) => setUsernameToLink(e.target.value.replace(/^@/, ''))}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
            }}
            disabled={isLinking}
          />
          <button
            type="submit"
            disabled={isLinking || !usernameToLink.trim()}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: 'none',
              background: '#58a6ff',
              color: 'white',
              fontWeight: 500,
              cursor: (isLinking || !usernameToLink.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isLinking || !usernameToLink.trim()) ? 0.6 : 1,
            }}
          >
            {isLinking ? 'Linking...' : 'Link Profile'}
          </button>
        </form>
      </div>

      {ownedProfiles && ownedProfiles.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {ownedProfiles.map((profile) => {
            const workspaceId = location.pathname.match(/\/workspaces\/([^/]+)/)?.[1];
            return (
              <SocialProfileCard
                key={profile.id}
                profile={profile}
                onSelect={() => {}} // Navigation handled by component
                brandId={brandId}
                workspaceId={workspaceId}
              />
            );
          })}
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
          <p style={{ margin: 0 }}>No profiles yet. Link one using the input above.</p>
        </div>
      )}
    </div>
  );
};
