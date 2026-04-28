import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api, getLatestOwnedSynthesis, getLatestOwnedVoice, triggerOwnedSynthesis, type OwnedSynthesis } from '../lib/api';
import { Loader, Send, RefreshCw, Sparkles, Link as LinkIcon, Volume2 } from 'lucide-react';

export const BrandOwnedView = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();

  // Fetch owned profiles
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['owned-profiles', brandId],
    queryFn: async () => {
      const { data } = await api.get(`/targets?brandId=${brandId}`);
      return data.filter((t: any) => t.socialProfile?.ownerId === brandId);
    },
    enabled: !!brandId,
  });

  // Fetch latest cached synthesis
  const { data: synthesis, isLoading: synthLoading } = useQuery<OwnedSynthesis | null>({
    queryKey: ['owned-synthesis', brandId],
    queryFn: () => getLatestOwnedSynthesis(brandId!),
    enabled: !!brandId,
  });

  // Fetch latest cached voice
  const { data: voice, isLoading: voiceLoading } = useQuery<OwnedSynthesis | null>({
    queryKey: ['owned-voice', brandId],
    queryFn: () => getLatestOwnedVoice(brandId!),
    enabled: !!brandId,
  });

  // Sync to flownau mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/brands/${brandId}/sync-owned-to-flownau`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owned-profiles', brandId] });
    },
  });

  // Manual synthesis update mutation
  const synthMutation = useMutation({
    mutationFn: () => triggerOwnedSynthesis(brandId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owned-synthesis', brandId] });
      queryClient.invalidateQueries({ queryKey: ['owned-voice', brandId] });
    },
  });

  if (isLoading) return <div>Loading Owned Profiles...</div>;

  const ownedProfiles = profiles || [];
  const synthErrorMsg =
    synthMutation.error instanceof Error
      ? synthMutation.error.message
      : ((synthMutation.error as any)?.response?.data?.error ?? 'Synthesis generation failed');

  return (
    <div>

      {/* ── Brand Identity Synthesis ─────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3
              style={{
                margin: '0 0 0.25rem 0',
                fontSize: '1rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Sparkles size={16} style={{ color: 'var(--accent)' }} />
              Brand Identity Synthesis
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
              ¿De qué trata esta marca? — Generated in Spanish from the brand's own published posts.
              {synthesis?.createdAt && (
                <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
                  Last updated: {new Date(synthesis.createdAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>

          <button
            onClick={() => synthMutation.mutate()}
            disabled={synthMutation.isPending || ownedProfiles.length === 0}
            className="btn-primary"
            title={
              ownedProfiles.length === 0
                ? 'No owned profiles — assign one first'
                : 'Regenerate synthesis from owned posts'
            }
            style={{
              padding: '0.55rem 1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: synthMutation.isPending || ownedProfiles.length === 0 ? 0.6 : 1,
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
            }}
          >
            {synthMutation.isPending ? (
              <>
                <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
                Generating…
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                Update Synthesis
              </>
            )}
          </button>
        </div>

        {/* Error state */}
        {synthMutation.isError && (
          <div
            style={{
              background: '#3d2121',
              border: '1px solid #5c2e2e',
              color: '#f87171',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            {synthErrorMsg}
          </div>
        )}

        {/* Synthesis content */}
        {synthLoading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading synthesis…</div>
        ) : synthesis ? (
          <div>
            <p
              style={{
                margin: '0 0 0.75rem 0',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {synthesis.content}
            </p>
            {Array.isArray(synthesis.attachedUrls) && synthesis.attachedUrls.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                {synthesis.attachedUrls.map((url: string) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.75rem',
                      color: 'var(--accent)',
                      textDecoration: 'none',
                      background: 'rgba(99,102,241,0.08)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    <LinkIcon size={11} />
                    View post
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
            No synthesis generated yet.{' '}
            {ownedProfiles.length > 0
              ? 'Click "Update Synthesis" to generate one from the owned posts.'
              : 'Assign an owned profile and scrape its posts first.'}
          </p>
        )}
      </div>

      {/* ── Brand Voice ─────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3
              style={{
                margin: '0 0 0.25rem 0',
                fontSize: '1rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Volume2 size={16} style={{ color: 'var(--accent)' }} />
              Brand Voice Guidelines
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
              ¿Cómo habla esta marca? — Derived directly from the published content.
              {voice?.createdAt && (
                <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
                  Last updated: {new Date(voice.createdAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>

        {voiceLoading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading voice guidelines…</div>
        ) : voice ? (
          <div>
            <p
              style={{
                margin: '0',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {voice.content}
            </p>
          </div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
            No voice guidelines extracted yet.
          </p>
        )}
      </div>

      {/* ── Owned Profiles ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <p style={{ color: '#8b949e', margin: 0 }}>
          {ownedProfiles.length === 0
            ? 'No profiles owned by this brand yet.'
            : `${ownedProfiles.length} profile(s) owned by this brand. Sync them to flownau to enable publishing.`}
        </p>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || ownedProfiles.length === 0}
          className="btn-primary"
          style={{
            padding: '0.6rem 1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: syncMutation.isPending ? 0.6 : 1,
          }}
        >
          {syncMutation.isPending ? (
            <>
              <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Syncing...
            </>
          ) : (
            <>
              <Send size={18} /> Sync to flownau
            </>
          )}
        </button>
      </div>

      {syncMutation.isError && (
        <div
          style={{
            background: '#3d2121',
            border: '1px solid #5c2e2e',
            color: '#f87171',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '2rem',
          }}
        >
          {syncMutation.error instanceof Error ? syncMutation.error.message : 'Sync failed'}
        </div>
      )}

      {syncMutation.isSuccess && (
        <div
          style={{
            background: '#1b3a1b',
            border: '1px solid #2d5a2d',
            color: '#86efac',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '2rem',
          }}
        >
          ✓ Synced {syncMutation.data?.synced || 0} / {syncMutation.data?.total || 0} profiles to flownau
          {syncMutation.data?.errors?.length > 0 && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#fca5a5' }}>
              Errors: {syncMutation.data.errors.map((e: any) => `${e.username} (${e.error})`).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Profiles Grid */}
      {ownedProfiles.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1rem',
          }}
        >
          {ownedProfiles.map((profile: any) => (
            <div
              key={profile.id}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                @{profile.socialProfile?.username}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>
                {profile.socialProfile?.platform || 'instagram'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                Status:{' '}
                <span style={{ color: profile.isActive ? '#86efac' : '#ef4444' }}>
                  {profile.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
