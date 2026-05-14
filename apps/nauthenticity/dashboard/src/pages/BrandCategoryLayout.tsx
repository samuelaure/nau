import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { getBrandTargets, addBrandTarget, capturePostByUrl, removeBrandTarget, getAccount, getProfileImageUrl, type Post } from '../lib/api';
import { Plus, ArrowLeft, X, Trash2, AlertTriangle } from 'lucide-react';
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
  const [absorbedToast, setAbsorbedToast] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ membershipId: string; label: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const queryKey = ['targets', brandId, category];

  const { data: memberships, isLoading } = useQuery({
    queryKey,
    queryFn: () => getBrandTargets(brandId!, targetType),
    enabled: !!brandId,
  });

  const addUsernameMutation = useMutation({
    mutationFn: (username: string) =>
      addBrandTarget({ brandId: brandId!, username, targetType, isActive: true }),
    onSuccess: (data) => {
      setInput('');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey });
      if (data?.absorbedPostCount > 0) {
        setAbsorbedToast(
          `${data.absorbedPostCount} post${data.absorbedPostCount > 1 ? 's' : ''} you'd previously added from this profile individually ${data.absorbedPostCount > 1 ? 'are' : 'is'} now grouped under this profile — they're still here, just accessible from the profile view.`
        );
      }
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

  const handleRemove = useCallback(async (membershipId: string, label: string) => {
    // Check if this is the last category for this profile/post
    const allMemberships: any[] = memberships ?? [];
    const targetMembership = allMemberships.find((m: any) => m.id === membershipId);
    if (!targetMembership) return;

    const entityId = targetMembership.socialProfileId ?? targetMembership.post?.id ?? targetMembership.postId;
    const siblingCount = allMemberships.filter((m: any) =>
      m.id !== membershipId &&
      ((targetMembership.socialProfileId && m.socialProfileId === targetMembership.socialProfileId) ||
       (entityId && (m.post?.id === entityId || m.postId === entityId)))
    ).length;

    if (siblingCount === 0) {
      // Last category — ask the user what to do
      setRemoveConfirm({ membershipId, label });
    } else {
      // Still in other categories, just remove this one silently
      setRemoving(membershipId);
      try {
        await removeBrandTarget(membershipId, 'remove');
        queryClient.invalidateQueries({ queryKey });
      } finally {
        setRemoving(null);
      }
    }
  }, [memberships, queryClient, queryKey]);

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
          element={isLoading ? <div>Loading...</div> : (
            <ProfilesTab profiles={profileMemberships} onRemove={handleRemove} removing={removing} />
          )}
        />
        <Route path="profiles/:username" element={<ProfileDetailView title={title} />} />
        <Route
          path="posts"
          element={isLoading ? <div>Loading...</div> : (
            <PostsTab postMemberships={postMemberships} onRemove={handleRemove} removing={removing} />
          )}
        />
        {extraTabs.map(tab => (
          <Route key={tab.key} path={tab.key} element={<>{tab.content}</>} />
        ))}
        <Route path="*" element={<Navigate to="profiles" replace />} />
      </Routes>

      {/* Absorbed posts toast */}
      {absorbedToast && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#1c2128', border: '1px solid rgba(88,166,255,0.3)', borderRadius: '10px', padding: '1rem 1.5rem', maxWidth: '480px', zIndex: 2000, display: 'flex', alignItems: 'flex-start', gap: '0.75rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <AlertTriangle size={18} style={{ color: '#e3b341', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9d1d9', lineHeight: '1.5' }}>{absorbedToast}</p>
          <button onClick={() => setAbsorbedToast(null)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '0', flexShrink: 0 }}><X size={16} /></button>
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeConfirm && (
        <div
          onClick={() => setRemoveConfirm(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '2rem', width: '440px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={20} style={{ color: '#e3b341', flexShrink: 0 }} />
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Not in any other category</h2>
            </div>
            <p style={{ margin: 0, color: '#8b949e', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <strong style={{ color: '#f0f6fc' }}>{removeConfirm.label}</strong> isn't in any other category. What would you like to do?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={async () => {
                  setRemoving(removeConfirm.membershipId);
                  setRemoveConfirm(null);
                  try {
                    await removeBrandTarget(removeConfirm.membershipId, 'benchmark');
                    queryClient.invalidateQueries({ queryKey });
                  } finally { setRemoving(null); }
                }}
                style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)', color: '#58a6ff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, textAlign: 'left' }}
              >
                📌 Move to Benchmarks
                <span style={{ display: 'block', fontSize: '0.78rem', color: '#8b949e', fontWeight: 400, marginTop: '2px' }}>Keep it in your library under Benchmarks for future reference.</span>
              </button>
              <button
                onClick={async () => {
                  setRemoving(removeConfirm.membershipId);
                  setRemoveConfirm(null);
                  try {
                    await removeBrandTarget(removeConfirm.membershipId, 'remove');
                    queryClient.invalidateQueries({ queryKey });
                  } finally { setRemoving(null); }
                }}
                style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, textAlign: 'left' }}
              >
                🗑️ Remove completely
                <span style={{ display: 'block', fontSize: '0.78rem', color: '#8b949e', fontWeight: 400, marginTop: '2px' }}>Remove it from your brand. It'll be fully deleted if no other brand uses it.</span>
              </button>
              <button onClick={() => setRemoveConfirm(null)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '0.85rem', padding: '0.25rem 0' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

const ProfilesTab = ({ profiles, onRemove, removing }: { profiles: any[]; onRemove: (id: string, label: string) => void; removing: string | null }) => {
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
          onDelete={async () => onRemove(m.id, `@${m.socialProfile?.username ?? 'profile'}`)}
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

const PostsTab = ({ postMemberships, onRemove, removing }: { postMemberships: any[]; onRemove: (id: string, label: string) => void; removing: string | null }) => {
  if (postMemberships.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '12px' }}>
        No posts added yet. Use "Add to …" to paste a post URL.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
      {postMemberships.map((m: any) => {
        const post: Post = {
          ...m.post,
          instagramUrl: m.post.url,
          likes: m.post.likes ?? 0,
          comments: m.post.comments ?? 0,
          media: m.post.media ?? [],
          collaborators: m.post.collaborators ?? [],
        };
        const label = m.post.username ? `@${m.post.username} post` : 'post';
        return (
          <div key={m.id} style={{ position: 'relative' }}>
            <PostGrid posts={[post]} sort="recent" />
            <button
              onClick={() => onRemove(m.id, label)}
              disabled={removing === m.id}
              title="Remove from this category"
              style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: removing === m.id ? '#555' : '#f85149', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', zIndex: 10 }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
