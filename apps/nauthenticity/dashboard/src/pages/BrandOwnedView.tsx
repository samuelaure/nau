import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getBrandOwnedProfiles, addOwnedProfile } from '../lib/api';
import { Loader, Send, RefreshCw, Sparkles, ChevronDown, ChevronUp, Save, Plus, X } from 'lucide-react';
import { SocialProfileCard } from '../components/SocialProfileCard';
import { ProfileDetail } from '../components/ProfileDetail';

// ── Brand Context Card ────────────────────────────────────────────────────────

interface BrandContextRecord {
  status: 'none' | 'idle' | 'generating' | 'ready' | 'failed';
  content?: string | null;
  customAdditions?: string | null;
  sources?: Record<string, unknown> | null;
  generatedAt?: string | null;
  updatedAt?: string;
}

interface GenerateSources {
  ownedProfile: boolean;
  inspoBase: boolean;
  previousContext: boolean;
  manual: string;
}

function BrandContextCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [sources, setSources] = useState<GenerateSources>({
    ownedProfile: true,
    inspoBase: true,
    previousContext: true,
    manual: '',
  });
  const [editedContent, setEditedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [customAdditions, setCustomAdditions] = useState('');
  const [customAdditionsDirty, setCustomAdditionsDirty] = useState(false);

  const { data: ctx, isLoading } = useQuery<BrandContextRecord>({
    queryKey: ['brand-context', brandId],
    queryFn: async () => {
      const { data } = await api.get(`/brands/${brandId}/context`);
      return data;
    },
    enabled: !!brandId,
  });

  useEffect(() => {
    if (ctx?.status === 'generating') {
      pollingRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['brand-context', brandId] });
      }, 3000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [ctx?.status, brandId, queryClient]);

  useEffect(() => {
    if (ctx?.content && !isEditing) setEditedContent(ctx.content);
  }, [ctx?.content, isEditing]);

  useEffect(() => {
    if (!customAdditionsDirty && ctx?.customAdditions != null) setCustomAdditions(ctx.customAdditions);
  }, [ctx?.customAdditions]);

  const saveCustomAdditionsMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/brands/${brandId}/context/custom-additions`, { customAdditions });
      return data;
    },
    onSuccess: () => {
      setCustomAdditionsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['brand-context', brandId] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/brands/${brandId}/context/generate`, {
        sources: {
          ownedProfile: sources.ownedProfile,
          inspoBase: sources.inspoBase,
          previousContext: sources.previousContext,
          manual: sources.manual.trim() || null,
        },
      });
      return data;
    },
    onSuccess: () => {
      setShowGeneratePanel(false);
      queryClient.invalidateQueries({ queryKey: ['brand-context', brandId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/brands/${brandId}/context`, { content: editedContent.trim() });
      return data;
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['brand-context', brandId] });
    },
  });

  const isGenerating = ctx?.status === 'generating';
  const hasContext = ctx?.status === 'ready' && ctx.content;
  const isFreshBrand = !hasContext;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            Brand Context
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
            Structured brand identity used for content generation.
            {ctx?.generatedAt && (
              <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
                Last generated: {new Date(ctx.generatedAt).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {hasContext && isEditing && (
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
              {saveMutation.isPending ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              Save
            </button>
          )}
          <button onClick={() => setShowGeneratePanel((v) => !v)} disabled={isGenerating} className="btn-primary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', opacity: isGenerating ? 0.6 : 1 }}>
            {isGenerating ? (
              <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
            ) : (
              <><RefreshCw size={14} />{hasContext ? 'Regenerate' : 'Generate'}{showGeneratePanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</>
            )}
          </button>
        </div>
      </div>

      {ctx?.status === 'failed' && (
        <div style={{ background: '#3d2121', border: '1px solid #5c2e2e', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Generation failed. Try again.
        </div>
      )}

      {showGeneratePanel && !isGenerating && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Choose sources for generation:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
            {([
              { key: 'ownedProfile' as const, label: 'Owned profile posts', disabled: false },
              { key: 'inspoBase' as const, label: 'InspoBase', disabled: false },
              { key: 'previousContext' as const, label: 'Previous context', disabled: !hasContext },
            ]).map(({ key, label, disabled }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
                <input type="checkbox" checked={sources[key]} onChange={(e) => setSources((s) => ({ ...s, [key]: e.target.checked }))} disabled={disabled} />
                {label}
              </label>
            ))}
          </div>
          <textarea
            value={sources.manual}
            onChange={(e) => setSources((s) => ({ ...s, manual: e.target.value }))}
            placeholder={isFreshBrand
              ? "Describe this brand:\n• What does it do or sell?\n• Who is the audience?\n• What's the tone and personality?\n• What topics does it cover?\n• What makes it different?"
              : 'Optional: add instructions or extra details to guide this generation…'}
            style={{ width: '100%', minHeight: isFreshBrand ? '140px' : '72px', padding: '0.625rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="btn-primary" style={{ padding: '0.55rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
              {generateMutation.isPending ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              Generate
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading…</div>
      ) : isGenerating ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Generating brand context…
        </div>
      ) : hasContext ? (
        <div>
          <textarea
            value={isEditing ? editedContent : (ctx.content ?? '')}
            onChange={(e) => { setIsEditing(true); setEditedContent(e.target.value); }}
            onFocus={() => { if (!isEditing) { setIsEditing(true); setEditedContent(ctx.content ?? ''); } }}
            style={{ width: '100%', minHeight: '240px', padding: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.78rem', color: '#6b7280' }}>Edit directly and click Save — changes sync to flownau automatically.</p>
        </div>
      ) : (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No brand context yet. Click Generate to create one from owned posts, InspoBase, or a manual description.</p>
      )}

      <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Custom Additions</p>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#6b7280' }}>Persists across regeneration. Appended to the brand context sent to content generation.</p>
          </div>
          {customAdditionsDirty && (
            <button onClick={() => saveCustomAdditionsMutation.mutate()} disabled={saveCustomAdditionsMutation.isPending} className="btn-primary" style={{ padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
              {saveCustomAdditionsMutation.isPending ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              Save
            </button>
          )}
        </div>
        <textarea
          value={customAdditions}
          onChange={(e) => { setCustomAdditions(e.target.value); setCustomAdditionsDirty(true); }}
          placeholder={"Add any extra details, rules, or notes that the AI should always consider for this brand...\n\nExamples:\n• Always reference our founding story in 2018\n• Never mention pricing directly\n• The founder's name is María and she often appears on camera"}
          style={{ width: '100%', minHeight: '120px', padding: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Profiles tab ──────────────────────────────────────────────────────────────

function ProfilesTab({ brandId }: { brandId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['owned-profiles', brandId],
    queryFn: () => getBrandOwnedProfiles(brandId),
    enabled: !!brandId,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/brands/${brandId}/social-profiles/sync-to-flownau`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owned-profiles', brandId] }),
  });

  const addMutation = useMutation({
    mutationFn: (username: string) => addOwnedProfile(brandId, username),
    onSuccess: () => {
      setInput('');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['owned-profiles', brandId] });
    },
  });

  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInput('');
      addMutation.reset();
    }
  }, [modalOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    addMutation.mutate(value);
  };

  if (isLoading) return <div>Loading…</div>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: '#8b949e', margin: 0 }}>
          {profiles.length === 0
            ? 'No owned profiles yet. Add one to get started.'
            : `${profiles.length} owned profile${profiles.length > 1 ? 's' : ''}.`}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || profiles.length === 0}
            className="btn-secondary"
            style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', opacity: syncMutation.isPending ? 0.6 : 1 }}
          >
            {syncMutation.isPending ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            Sync to flownau
          </button>
          <button onClick={() => setModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
            <Plus size={16} /> Add profile
          </button>
        </div>
      </div>

      {syncMutation.isSuccess && (
        <div style={{ background: '#1b3a1b', border: '1px solid #2d5a2d', color: '#86efac', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          ✓ Synced {syncMutation.data?.synced || 0} / {syncMutation.data?.total || 0} profiles to flownau
        </div>
      )}

      {profiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {profiles.map((profile: any) => (
            <SocialProfileCard
              key={profile.id}
              profile={profile}
              onSelect={(username) => navigate(`profiles/${username}`)}
              brandId={brandId}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '2rem', width: '440px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Add owned profile</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 0 }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Instagram username or profile URL"
                style={{ width: '100%', padding: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
              {addMutation.isError && (
                <p style={{ margin: 0, color: '#f87171', fontSize: '0.85rem' }}>
                  {(addMutation.error as any)?.response?.data?.message || 'Failed to add profile.'}
                </p>
              )}
              <button type="submit" disabled={addMutation.isPending || !input.trim()} className="btn-primary" style={{ padding: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: addMutation.isPending ? 0.6 : 1 }}>
                {addMutation.isPending ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={15} />}
                Add profile
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export const BrandOwnedView = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const location = useLocation();
  const isOnProfile = location.pathname.includes('/profiles/');

  if (!brandId) return null;

  return (
    <div className="fade-in">
      {!isOnProfile && <BrandContextCard brandId={brandId} />}

      <Routes>
        <Route path="profiles" element={<ProfilesTab brandId={brandId} />} />
        <Route path="profiles/:username" element={<ProfileDetail backLabel="Back to Owned Profiles" backPath="../profiles" brandId={brandId} showSourceConcepts />} />
        <Route path="*" element={<Navigate to="profiles" replace />} />
      </Routes>
    </div>
  );
};
