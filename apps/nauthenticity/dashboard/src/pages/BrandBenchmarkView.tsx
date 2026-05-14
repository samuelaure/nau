import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBrandTargets, addBrandTarget, updateBrandTarget, capturePostByUrl } from '../lib/api';
import { BarChart2, Plus, User, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const BrandBenchmarkView = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();
  const [usernameInput, setUsernameInput] = useState('');
  const [postUrlInput, setPostUrlInput] = useState('');

  const { data: memberships, isLoading } = useQuery({
    queryKey: ['targets', brandId, 'BENCHMARK'],
    queryFn: () => getBrandTargets(brandId!, 'benchmark'),
    enabled: !!brandId,
  });

  const addUsernameMutation = useMutation({
    mutationFn: (username: string) =>
      addBrandTarget({ brandId: brandId!, username, targetType: 'benchmark', isActive: true }),
    onSuccess: () => {
      setUsernameInput('');
      queryClient.invalidateQueries({ queryKey: ['targets', brandId, 'BENCHMARK'] });
    },
  });

  const addPostUrlMutation = useMutation({
    mutationFn: (postUrl: string) => capturePostByUrl(brandId!, postUrl, 'BENCHMARK'),
    onSuccess: () => {
      setPostUrlInput('');
      queryClient.invalidateQueries({ queryKey: ['targets', brandId, 'BENCHMARK'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateBrandTarget(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets', brandId, 'BENCHMARK'] });
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

  if (isLoading) return <div>Loading Benchmarks...</div>;

  const profileMemberships = (memberships ?? []).filter((m: any) => m.socialProfile);
  const postMemberships = (memberships ?? []).filter((m: any) => m.post);

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart2 size={28} style={{ color: '#0969da' }} /> Benchmarks
        </h1>
        <p style={{ color: '#8b949e', margin: '0.5rem 0 0 0' }}>
          Profiles and posts tracked for competitive analysis and visual benchmarking.
        </p>
      </div>

      {/* Add Forms */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0' }}>Add to Benchmarks</h3>

        <form onSubmit={handleAddUsername} style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
            <User size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="@username or profile URL"
              style={{
                width: '100%',
                padding: '0.6rem 1rem 0.6rem 2rem',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                color: 'white',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={addUsernameMutation.isPending || !usernameInput.trim()}
            style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
          >
            <Plus size={16} />
            {addUsernameMutation.isPending ? 'Adding...' : 'Add Profile'}
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
              style={{
                width: '100%',
                padding: '0.6rem 1rem 0.6rem 2rem',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                color: 'white',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={addPostUrlMutation.isPending || !postUrlInput.trim()}
            style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
          >
            <Plus size={16} />
            {addPostUrlMutation.isPending ? 'Adding...' : 'Add Post'}
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

      {/* Profiles */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem 0', border: 'none', color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={18} /> Profiles ({profileMemberships.length})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {profileMemberships.map((m: any) => (
            <div
              key={m.id}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                opacity: m.isActive ? 1 : 0.6,
                cursor: 'pointer',
              }}
              onClick={() => toggleMutation.mutate({ id: m.id, isActive: !m.isActive })}
              title={m.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#333', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                {m.socialProfile.profileImageUrl ? (
                  <img src={m.socialProfile.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={18} />
                )}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>@{m.socialProfile.username}</div>
                <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>
                  {m.socialProfile._count?.posts || 0} posts captured
                </div>
              </div>
            </div>
          ))}
          {profileMemberships.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '10px' }}>
              No profiles added yet.
            </div>
          )}
        </div>
      </section>

      {/* Posts */}
      <section>
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem 0', border: 'none', color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LinkIcon size={18} /> Posts ({postMemberships.length})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {postMemberships.map((m: any) => (
            <div key={m.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#c9d1d9', lineHeight: '1.5', maxHeight: '4.5em', overflow: 'hidden' }}>
                {m.post.caption || <span style={{ color: '#8b949e' }}>No caption</span>}
              </div>
              {m.post.url && (
                <a href={m.post.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#58a6ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ExternalLink size={12} /> View on Instagram
                </a>
              )}
              <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>
                {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
              </div>
            </div>
          ))}
          {postMemberships.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '10px' }}>
              No posts added yet. Paste an Instagram post URL above.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
