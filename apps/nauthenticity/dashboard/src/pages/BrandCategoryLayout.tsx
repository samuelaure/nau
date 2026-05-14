import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { getBrandTargets, addBrandTarget, capturePostByUrl, getAccount, getProfileImageUrl, type Post } from '../lib/api';
import { Plus, ArrowLeft, X } from 'lucide-react';
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
  extraActionButtons?: React.ReactNode;
  headerPanelContent?: React.ReactNode;
  extraTabs?: ExtraTab[];
}

function detectInputType(input: string): 'post' | 'profile' {
  const s = input.trim();
  return s.includes('/p/') || s.includes('/reel/') ? 'post' : 'profile';
}

export const BrandCategoryLayout = ({
  category,
  targetType,
  title,
  icon,
  extraActionButtons,
  headerPanelContent,
  extraTabs = [],
}: BrandCategoryLayoutProps) => {
  const { brandId } = useParams<{ brandId: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
      setInput('');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const addPostUrlMutation = useMutation({
    mutationFn: (postUrl: string) => capturePostByUrl(brandId!, postUrl, category),
    onSuccess: () => {
      setInput('');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isPending = addUsernameMutation.isPending || addPostUrlMutation.isPending;
  const isError = addUsernameMutation.isError || addPostUrlMutation.isError;
  const errorMsg =
    (addUsernameMutation.error as any)?.response?.data?.message ||
    (addPostUrlMutation.error as any)?.response?.data?.message ||
    'Failed to add. Check the URL and try again.';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value || !brandId) return;
    if (detectInputType(value) === 'post') {
      addPostUrlMutation.mutate(value);
    } else {
      let clean = value;
      if (clean.includes('instagram.com/')) clean = clean.split('instagram.com/')[1].split('/')[0];
      if (clean.startsWith('@')) clean = clean.slice(1);
      addUsernameMutation.mutate(clean);
    }
  };

  // Focus input when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInput('');
      addUsernameMutation.reset();
      addPostUrlMutation.reset();
    }
  }, [modalOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const profileMemberships = (memberships ?? []).filter((m: any) => m.socialProfile);
  const postMemberships = (memberships ?? []).filter((m: any) => m.post);

  const tabs = [
    { key: 'profiles', label: `Profiles (${profileMemberships.length})` },
    { key: 'posts', label: `Posts (${postMemberships.length})` },
    ...extraTabs.map(t => ({ key: t.key, label: t.label })),
  ];

  const isOnProfile = location.pathname.includes('/profiles/');

  // Detect what the input currently looks like (for hint text in modal)
  const inputType = input.trim() ? detectInputType(input) : null;

  return (
    <div className="fade-in">
      {!isOnProfile && (
        <>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {icon} {title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {extraActionButtons}
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              >
                <Plus size={16} /> Add to {title}
              </button>
            </div>
          </div>

          {/* Optional collapsible panel (e.g. Creative Direction for Inspo) */}
          {headerPanelContent && (
            <div style={{ marginBottom: '1.5rem' }}>{headerPanelContent}</div>
          )}

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
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
                  whiteSpace: 'nowrap',
                })}
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </>
      )}

      {/* Tab content */}
      <Routes>
        <Route
          path="profiles"
          element={isLoading ? <div>Loading...</div> : <ProfilesTab profiles={profileMemberships} />}
        />
        <Route path="profiles/:username" element={<ProfileDetailView title={title} />} />
        <Route
          path="posts"
          element={isLoading ? <div>Loading...</div> : <PostsTab postMemberships={postMemberships} />}
        />
        {extraTabs.map(tab => (
          <Route key={tab.key} path={tab.key} element={<>{tab.content}</>} />
        ))}
        <Route path="*" element={<Navigate to="profiles" replace />} />
      </Routes>

      {/* Add Modal */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '2rem', width: '480px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Add to {title}</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: 0, color: '#8b949e', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Paste an Instagram profile URL, @username, or post/reel URL. We'll detect which one it is automatically.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="@username, profile URL, or post URL"
                  style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', color: 'white', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                />
                {inputType && (
                  <span style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: inputType === 'post' ? '#a371f7' : '#3fb950',
                    background: inputType === 'post' ? 'rgba(163,113,247,0.15)' : 'rgba(63,185,80,0.15)',
                    padding: '2px 8px', borderRadius: '100px',
                  }}>
                    {inputType === 'post' ? 'Post' : 'Profile'}
                  </span>
                )}
              </div>

              {isError && (
                <p style={{ margin: 0, color: '#f85149', fontSize: '0.85rem' }}>{errorMsg}</p>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={isPending || !input.trim()}
                style={{ padding: '0.75rem', fontSize: '0.95rem', fontWeight: 600 }}
              >
                {isPending ? 'Adding...' : `Add ${inputType === 'post' ? 'Post' : 'Profile'}`}
              </button>
            </form>
          </div>
        </div>
      )}
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

// ── Profile Detail ────────────────────────────────────────────────────────────

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
        No posts added yet. Use "Add to …" to paste a post URL.
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
