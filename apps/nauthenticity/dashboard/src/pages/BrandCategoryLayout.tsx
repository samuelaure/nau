import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useParams, useNavigate, useLocation, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { getBrandTargets, addBrandTarget, capturePostByUrl, getAccount, getProfileImageUrl, type Post } from '../lib/api';
import { Plus, User, Link as LinkIcon, ArrowLeft } from 'lucide-react';
import { SocialProfileCard } from '../components/SocialProfileCard';
import { PostGrid } from '../components/PostGrid';

interface ExtraTab {
  key: string;
  label: string;
  content: React.ReactNode;
}

interface BrandCategoryLayoutProps {
  category: 'INSPO' | 'COMMENT' | 'BENCHMARK';
  targetType: string;
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  description: string;
  extraHeaderContent?: React.ReactNode;
  extraTabs?: ExtraTab[];
}

export const BrandCategoryLayout = ({
  category,
  targetType,
  title,
  icon,
  description,
  extraHeaderContent,
  extraTabs = [],
}: BrandCategoryLayoutProps) => {
  const { brandId } = useParams<{ brandId: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [usernameInput, setUsernameInput] = useState('');
  const [postUrlInput, setPostUrlInput] = useState('');

  const queryKey = ['targets', brandId, category];

  const { data: memberships, isLoading } = useQuery({
    queryKey,
    queryFn: () => getBrandTargets(brandId!, targetType),
    enabled: !!brandId,
  });

  const addUsernameMutation = useMutation({
    mutationFn: (username: string) =>
      addBrandTarget({ brandId: brandId!, username, targetType, isActive: true }),
    onSuccess: () => {
      setUsernameInput('');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const addPostUrlMutation = useMutation({
    mutationFn: (postUrl: string) => capturePostByUrl(brandId!, postUrl, category),
    onSuccess: () => {
      setPostUrlInput('');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleAddUsername = (e: React.FormEvent) => {
    e.preventDefault();
    let clean = usernameInput.trim();
    if (clean.includes('instagram.com/')) clean = clean.split('instagram.com/')[1].split('/')[0];
    if (clean.startsWith('@')) clean = clean.slice(1);
    if (!clean || !brandId) return;
    addUsernameMutation.mutate(clean);
  };

  const handleAddPostUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postUrlInput.trim() || !brandId) return;
    addPostUrlMutation.mutate(postUrlInput.trim());
  };

  const profileMemberships = (memberships ?? []).filter((m: any) => m.socialProfile);
  const postMemberships = (memberships ?? []).filter((m: any) => m.post);

  const tabs = [
    { key: 'profiles', label: `Profiles (${profileMemberships.length})` },
    { key: 'posts', label: `Posts (${postMemberships.length})` },
    ...extraTabs.map(t => ({ key: t.key, label: t.label })),
  ];

  const isOnProfile = location.pathname.includes('/profiles/');

  return (
    <div className="fade-in">
      {!isOnProfile && (
        <>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {icon} {title}
            </h1>
            <p style={{ color: '#8b949e', margin: '0.5rem 0 0 0' }}>{description}</p>
          </div>

          {/* Add Forms */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Add to {title}</h3>

            <form onSubmit={handleAddUsername} style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
                <User size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="@username or profile URL"
                  style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={addUsernameMutation.isPending || !usernameInput.trim()} style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                <Plus size={16} />{addUsernameMutation.isPending ? 'Adding...' : 'Add Profile'}
              </button>
            </form>

            <form onSubmit={handleAddPostUrl} style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
                <LinkIcon size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
                <input
                  type="text"
                  value={postUrlInput}
                  onChange={(e) => setPostUrlInput(e.target.value)}
                  placeholder="Instagram post URL"
                  style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={addPostUrlMutation.isPending || !postUrlInput.trim()} style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                <Plus size={16} />{addPostUrlMutation.isPending ? 'Adding...' : 'Add Post'}
              </button>
            </form>

            {(addUsernameMutation.isError || addPostUrlMutation.isError) && (
              <p style={{ margin: 0, color: '#f85149', fontSize: '0.85rem' }}>
                {(addUsernameMutation.error as any)?.response?.data?.message ||
                  (addPostUrlMutation.error as any)?.response?.data?.message ||
                  'Failed to add.'}
              </p>
            )}
          </div>

          {/* Extra header content (e.g. synthesis for InspoBase) */}
          {extraHeaderContent}

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
            {tabs.map(tab => (
              <NavLink
                key={tab.key}
                to={tab.key}
                style={({ isActive }) => ({
                  textDecoration: 'none',
                  color: isActive ? '#58a6ff' : '#8b949e',
                  fontWeight: isActive ? 600 : 400,
                  padding: '0.5rem 1rem',
                  borderBottom: isActive ? '2px solid #58a6ff' : '2px solid transparent',
                  transition: 'color 0.15s',
                  fontSize: '0.95rem',
                })}
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </>
      )}

      {/* Tab Content */}
      <Routes>
        <Route
          path="profiles"
          element={
            isLoading ? <div>Loading...</div> : (
              <ProfilesTab profiles={profileMemberships} />
            )
          }
        />
        <Route
          path="profiles/:username"
          element={<ProfileDetailView title={title} />}
        />
        <Route
          path="posts"
          element={
            isLoading ? <div>Loading...</div> : (
              <PostsTab postMemberships={postMemberships} />
            )
          }
        />
        {extraTabs.map(tab => (
          <Route key={tab.key} path={tab.key} element={<>{tab.content}</>} />
        ))}
        <Route path="*" element={<Navigate to="profiles" replace />} />
      </Routes>
    </div>
  );
};

// ── Profiles Tab ──────────────────────────────────────────────────────────────

const ProfilesTab = ({ profiles }: { profiles: any[] }) => {
  const navigate = useNavigate();

  if (profiles.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '12px' }}>
        No profiles added yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
      {profiles.map((m: any) => (
        <SocialProfileCard
          key={m.id}
          profile={m.socialProfile}
          onSelect={(username) => navigate(`../profiles/${username}`)}
        />
      ))}
    </div>
  );
};

// ── Profile Detail (inline drill-down) ───────────────────────────────────────

const ProfileDetailView = ({ title }: { title: string }) => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [sort, setSort] = useState<'recent' | 'oldest' | 'likes' | 'comments'>('recent');

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', username],
    queryFn: () => getAccount(username!),
    enabled: !!username,
  });

  return (
    <div className="fade-in">
      {/* Back + Header */}
      <button
        onClick={() => navigate('../profiles')}
        style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px', padding: 0, fontWeight: 500 }}
      >
        <ArrowLeft size={16} /> Back to {title} Profiles
      </button>

      {isLoading || !account ? (
        <div style={{ color: '#8b949e' }}>Loading @{username}...</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            <img
              src={getProfileImageUrl(account.profileImageUrl, account.platform || 'instagram')}
              alt={account.username}
              style={{ width: '72px', height: '72px', borderRadius: '50%', border: '2px solid var(--border)', backgroundColor: 'var(--card-bg)', padding: account.profileImageUrl ? '0' : '10px', objectFit: 'cover' }}
            />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.75rem' }}>@{account.username}</h2>
              <span style={{ color: '#8b949e', fontSize: '0.9rem' }}>{account.posts?.length ?? 0} posts captured</span>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              style={{ padding: '0.5rem', borderRadius: '4px', background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="likes">Most Likes</option>
              <option value="comments">Most Comments</option>
            </select>
          </div>

          {account.posts?.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#8b949e', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              No posts captured yet for this profile.
            </div>
          ) : (
            <PostGrid posts={account.posts} sort={sort} />
          )}
        </>
      )}
    </div>
  );
};

// ── Posts Tab ─────────────────────────────────────────────────────────────────

const PostsTab = ({ postMemberships }: { postMemberships: any[] }) => {
  if (postMemberships.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '12px' }}>
        No posts added yet. Paste an Instagram post URL in the form above.
      </div>
    );
  }

  const posts: Post[] = postMemberships.map((m: any) => ({
    ...m.post,
    instagramUrl: m.post.url,
    likes: m.post.likes ?? 0,
    comments: m.post.comments ?? 0,
    media: m.post.media ?? [],
    collaborators: m.post.collaborators ?? [],
  }));

  return <PostGrid posts={posts} sort="recent" />;
};
