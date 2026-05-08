import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader, Send, RefreshCw, Sparkles, ChevronDown, ChevronUp, Save } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandContextRecord {
  status: 'none' | 'idle' | 'generating' | 'ready' | 'failed';
  content?: Record<string, unknown> | null;
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

// ── Brand Context Card ────────────────────────────────────────────────────────

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

  const { data: ctx, isLoading } = useQuery<BrandContextRecord>({
    queryKey: ['brand-context', brandId],
    queryFn: async () => {
      const { data } = await api.get(`/brands/${brandId}/context`);
      return data;
    },
    enabled: !!brandId,
  });

  // Poll while generating
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

  // Sync edit textarea when context loads
  useEffect(() => {
    if (ctx?.content && !isEditing) {
      setEditedContent(JSON.stringify(ctx.content, null, 2));
    }
  }, [ctx?.content, isEditing]);

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
      let parsed: unknown;
      try {
        parsed = JSON.parse(editedContent);
      } catch {
        throw new Error('Invalid JSON — fix the content before saving.');
      }
      const { data } = await api.patch(`/brands/${brandId}/context`, { content: parsed });
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
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem', marginBottom: '2rem' }}>

      {/* Header */}
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
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-primary"
              style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
            >
              {saveMutation.isPending ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              Save
            </button>
          )}
          <button
            onClick={() => setShowGeneratePanel((v) => !v)}
            disabled={isGenerating}
            className="btn-primary"
            style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', opacity: isGenerating ? 0.6 : 1 }}
          >
            {isGenerating ? (
              <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
            ) : (
              <><RefreshCw size={14} />{hasContext ? 'Regenerate' : 'Generate'}{showGeneratePanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {ctx?.status === 'failed' && (
        <div style={{ background: '#3d2121', border: '1px solid #5c2e2e', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Generation failed. Try again.
        </div>
      )}
      {saveMutation.isError && (
        <div style={{ background: '#3d2121', border: '1px solid #5c2e2e', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {saveMutation.error instanceof Error ? saveMutation.error.message : 'Save failed.'}
        </div>
      )}

      {/* Generate panel */}
      {showGeneratePanel && !isGenerating && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Choose sources for generation:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
            {([
              { key: 'ownedProfile' as const, label: 'Owned profile posts', disabled: false },
              { key: 'inspoBase' as const, label: 'InspoBase', disabled: false },
              { key: 'previousContext' as const, label: 'Previous context', disabled: !hasContext },
            ]).map(({ key, label, disabled }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
                <input
                  type="checkbox"
                  checked={sources[key]}
                  onChange={(e) => setSources((s) => ({ ...s, [key]: e.target.checked }))}
                  disabled={disabled}
                />
                {label}
              </label>
            ))}
          </div>

          <textarea
            value={sources.manual}
            onChange={(e) => setSources((s) => ({ ...s, manual: e.target.value }))}
            placeholder={
              isFreshBrand
                ? "Describe this brand:\n• What does it do or sell?\n• Who is the audience?\n• What's the tone and personality?\n• What topics does it cover?\n• What makes it different?"
                : 'Optional: add instructions or extra details to guide this generation…'
            }
            style={{
              width: '100%',
              minHeight: isFreshBrand ? '140px' : '72px',
              padding: '0.625rem',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-primary"
              style={{ padding: '0.55rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
            >
              {generateMutation.isPending ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              Generate
            </button>
          </div>
        </div>
      )}

      {/* Content */}
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
            value={isEditing ? editedContent : JSON.stringify(ctx.content, null, 2)}
            onChange={(e) => { setIsEditing(true); setEditedContent(e.target.value); }}
            onFocus={() => setIsEditing(true)}
            style={{
              width: '100%',
              minHeight: '240px',
              padding: '0.75rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
            Edit JSON directly and click Save — changes sync to flownau automatically.
          </p>
        </div>
      ) : (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          No brand context yet. Click Generate to create one from owned posts, InspoBase, or a manual description.
        </p>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export const BrandOwnedView = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['owned-profiles', brandId],
    queryFn: async () => {
      const { data } = await api.get(`/brands/${brandId}/owned-profiles`);
      return data;
    },
    enabled: !!brandId,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/brands/${brandId}/sync-owned-to-flownau`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owned-profiles', brandId] });
    },
  });

  if (isLoading || !brandId) return <div>Loading…</div>;

  const ownedProfiles = profiles || [];

  return (
    <div>
      <BrandContextCard brandId={brandId} />

      {/* ── Owned Profiles ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <p style={{ color: '#8b949e', margin: 0 }}>
          {ownedProfiles.length === 0
            ? 'No profiles owned by this brand yet.'
            : `${ownedProfiles.length} profile(s) owned by this brand. Sync them to flownau to enable publishing.`}
        </p>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || ownedProfiles.length === 0}
          className="btn-primary"
          style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: syncMutation.isPending ? 0.6 : 1 }}
        >
          {syncMutation.isPending ? (
            <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Syncing...</>
          ) : (
            <><Send size={18} /> Sync to flownau</>
          )}
        </button>
      </div>

      {syncMutation.isError && (
        <div style={{ background: '#3d2121', border: '1px solid #5c2e2e', color: '#f87171', padding: '1rem', borderRadius: '6px', marginBottom: '2rem' }}>
          {syncMutation.error instanceof Error ? syncMutation.error.message : 'Sync failed'}
        </div>
      )}

      {syncMutation.isSuccess && (
        <div style={{ background: '#1b3a1b', border: '1px solid #2d5a2d', color: '#86efac', padding: '1rem', borderRadius: '6px', marginBottom: '2rem' }}>
          ✓ Synced {syncMutation.data?.synced || 0} / {syncMutation.data?.total || 0} profiles to flownau
          {syncMutation.data?.errors?.length > 0 && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#fca5a5' }}>
              Errors: {syncMutation.data.errors.map((e: any) => `${e.username} (${e.error})`).join(', ')}
            </div>
          )}
        </div>
      )}

      {ownedProfiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {ownedProfiles.map((profile: any) => (
            <div key={profile.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>@{profile.username}</div>
              <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>{profile.platform || 'instagram'}</div>
              {profile.lastScrapedAt && (
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Last scraped: {new Date(profile.lastScrapedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
