import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader, Send } from 'lucide-react';

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

  if (isLoading) return <div>Loading Owned Profiles...</div>;

  const ownedProfiles = profiles || [];

  return (
    <div>
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
                Status: <span style={{ color: profile.isActive ? '#86efac' : '#ef4444' }}>
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
