import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getBrandTargets,
  getInspoDigest,
  addInspoByUsername,
  addInspoByPostUrl,
  getVoicenotes,
} from '../lib/api';
import { Sparkles, RefreshCw, ExternalLink, Plus, User, Link as LinkIcon, Mic } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const BrandInspoBaseView = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();
  const [usernameInput, setUsernameInput] = useState('');
  const [postUrlInput, setPostUrlInput] = useState('');

  const { data: memberships, isLoading: loadingItems } = useQuery({
    queryKey: ['targets', brandId, 'INSPO'],
    queryFn: () => getBrandTargets(brandId!, 'inspo'),
    enabled: !!brandId,
  });

  const { data: digest, isLoading: loadingDigest, refetch: refetchDigest, isFetching: fetchingDigest } = useQuery({
    queryKey: ['inspo-digest', brandId],
    queryFn: () => getInspoDigest(brandId!),
    enabled: !!brandId,
  });

  const { data: voicenotes, isLoading: loadingVoicenotes } = useQuery({
    queryKey: ['voicenotes', brandId],
    queryFn: () => getVoicenotes(brandId!),
    enabled: !!brandId,
  });

  const addUsernameMutation = useMutation({
    mutationFn: (username: string) => addInspoByUsername(brandId!, username),
    onSuccess: () => {
      setUsernameInput('');
      queryClient.invalidateQueries({ queryKey: ['targets', brandId, 'INSPO'] });
    },
  });

  const addPostUrlMutation = useMutation({
    mutationFn: (postUrl: string) => addInspoByPostUrl(brandId!, postUrl),
    onSuccess: () => {
      setPostUrlInput('');
      queryClient.invalidateQueries({ queryKey: ['targets', brandId, 'INSPO'] });
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

  if (loadingItems || loadingDigest) return <div>Loading InspoBase...</div>;

  const profileMemberships = (memberships ?? []).filter((m: any) => m.socialProfile);
  const postMemberships = (memberships ?? []).filter((m: any) => m.post);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={28} style={{ color: '#d29922' }} /> InspoBase
        </h1>
        <p style={{ color: '#8b949e', margin: '0.5rem 0 0 0' }}>
          Profiles and posts that fuel your brand's creative direction.
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
        <h3 style={{ margin: '0 0 0.5rem 0' }}>Add to InspoBase</h3>

        {/* Add by username */}
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
                paddingLeft: '32px',
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

        {/* Add by post URL */}
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
                paddingLeft: '32px',
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
              'Failed to add. Make sure the post has been scraped first.'}
          </p>
        )}
      </div>

      {/* Creative Direction */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c9d1d9' }}>
            <Sparkles size={18} style={{ color: '#d29922' }} />
            <h2 style={{ fontSize: '1.25rem', margin: 0, border: 'none' }}>Current Creative Direction</h2>
          </div>
          <button
            onClick={() => refetchDigest()}
            disabled={fetchingDigest}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.9rem',
              background: 'rgba(88, 166, 255, 0.1)',
              color: '#58a6ff',
              border: '1px solid rgba(88, 166, 255, 0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            <RefreshCw size={14} className={fetchingDigest ? 'spin' : ''} />
            {fetchingDigest ? 'Synthesizing...' : 'Trigger Synthesis'}
          </button>
        </div>

        {digest ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #d29922, #58a6ff)' }} />
            <p style={{ lineHeight: '1.6', fontSize: '1.05rem', color: '#f0f6fc', whiteSpace: 'pre-wrap', margin: 0 }}>
              {digest.content}
            </p>
            {digest.attachedUrls?.length > 0 && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Influences</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {digest.attachedUrls.map((url: string) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#58a6ff', textDecoration: 'none', background: 'rgba(88, 166, 255, 0.1)', padding: '4px 10px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ExternalLink size={12} />
                      {url.split('/p/')[1]?.split('/')[0] || 'View Post'}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
            No synthesis generated yet. Add some inspo items and trigger one.
          </div>
        )}
      </section>

      {/* Inspo Profiles */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem 0', border: 'none', color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={18} /> Profiles ({profileMemberships.length})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {profileMemberships.map((m: any) => (
            <div key={m.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
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

      {/* Inspo Posts */}
      <section style={{ marginBottom: '3rem' }}>
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

      {/* Voicenotes */}
      <section>
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem 0', border: 'none', color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Mic size={18} /> Voicenotes {!loadingVoicenotes && `(${voicenotes?.length ?? 0})`}
        </h2>
        {loadingVoicenotes ? (
          <div style={{ color: '#8b949e' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(voicenotes ?? []).map((v: any) => (
              <div key={v.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>
                    {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#c9d1d9', lineHeight: '1.6' }}>
                  {v.cleanTranscription}
                </p>
                {v.synthesis && (
                  <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Synthesis</span>
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: '#f0f6fc', fontStyle: 'italic', lineHeight: '1.5' }}>
                      {v.synthesis}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {(voicenotes ?? []).length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '10px' }}>
                No voicenotes captured yet. Send a voice message to Zazŭ to capture content ideas.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
