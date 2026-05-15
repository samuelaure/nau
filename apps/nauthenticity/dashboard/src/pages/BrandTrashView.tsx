import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getTrashItems, restoreTrashItem, permanentlyDeleteTrashItem, getProfileImageUrl, type TrashItem } from '../lib/api';
import { Trash2, RotateCcw, AlertTriangle, Clock } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';

const CATEGORY_LABEL: Record<string, string> = {
  INSPO: 'InspoBase',
  COMMENT: 'Comments',
  BENCHMARK: 'Benchmarks',
};

export const BrandTrashView = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();
  const queryKey = ['trash', brandId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getTrashItems(brandId!),
    enabled: !!brandId,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreTrashItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => permanentlyDeleteTrashItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const handlePermanentDelete = (item: TrashItem) => {
    const label = item.socialProfile ? `@${item.socialProfile.username}` : 'this post';
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    deleteMutation.mutate(item.id);
  };

  if (isLoading) {
    return <div style={{ color: '#8b949e', padding: '2rem' }}>Loading trash…</div>;
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: '#8b949e' }}>
        <Trash2 size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
        <p style={{ margin: 0, fontSize: '0.95rem' }}>Trash is empty.</p>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem' }}>Removed profiles and posts will appear here for 30 days.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trash2 size={28} style={{ color: '#8b949e' }} /> Trash
        </h1>
        <p style={{ margin: '0.4rem 0 0', color: '#8b949e', fontSize: '0.88rem' }}>
          Items removed from all categories. Recoverable for 30 days, then permanently deleted.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map(item => (
          <TrashItemRow
            key={item.id}
            item={item}
            restoring={restoreMutation.isPending && restoreMutation.variables === item.id}
            deleting={deleteMutation.isPending && deleteMutation.variables === item.id}
            onRestore={() => restoreMutation.mutate(item.id)}
            onDelete={() => handlePermanentDelete(item)}
          />
        ))}
      </div>
    </div>
  );
};

const TrashItemRow = ({
  item,
  restoring,
  deleting,
  onRestore,
  onDelete,
}: {
  item: TrashItem;
  restoring: boolean;
  deleting: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) => {
  const daysLeft = differenceInDays(new Date(item.expiresAt), new Date());
  const isExpiringSoon = daysLeft <= 3;

  const thumbnail = item.socialProfile
    ? getProfileImageUrl(item.socialProfile.profileImageUrl, item.socialProfile.platform)
    : item.post?.media?.[0]?.thumbnailUrl ?? item.post?.media?.[0]?.storageUrl ?? null;

  const label = item.socialProfile
    ? `@${item.socialProfile.username}`
    : item.post?.username
    ? `Post by @${item.post.username}`
    : 'Post';

  const type = item.socialProfile ? 'Profile' : 'Post';
  const categoryLabel = CATEGORY_LABEL[item.originalCategory] ?? item.originalCategory;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '1rem',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '0.9rem 1.1rem',
    }}>
      {thumbnail ? (
        <img src={thumbnail} alt={label} style={{ width: '44px', height: '44px', borderRadius: item.socialProfile ? '50%' : '6px', objectFit: 'cover', flexShrink: 0, background: '#21262d' }} />
      ) : (
        <div style={{ width: '44px', height: '44px', borderRadius: item.socialProfile ? '50%' : '6px', background: '#21262d', flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f0f6fc' }}>{label}</span>
          <span style={{ fontSize: '0.72rem', background: '#21262d', border: '1px solid #30363d', color: '#8b949e', padding: '1px 7px', borderRadius: '999px' }}>{type}</span>
          <span style={{ fontSize: '0.72rem', background: '#21262d', border: '1px solid #30363d', color: '#8b949e', padding: '1px 7px', borderRadius: '999px' }}>was in {categoryLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
          <Clock size={11} style={{ color: isExpiringSoon ? '#f85149' : '#8b949e' }} />
          <span style={{ fontSize: '0.78rem', color: isExpiringSoon ? '#f85149' : '#8b949e' }}>
            {daysLeft <= 0
              ? 'Expires today'
              : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left · deleted ${formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}`}
          </span>
          {isExpiringSoon && <AlertTriangle size={11} style={{ color: '#f85149' }} />}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={onRestore}
          disabled={restoring || deleting}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', borderRadius: '6px', background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)', color: '#58a6ff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: restoring ? 0.6 : 1 }}
        >
          <RotateCcw size={13} />
          {restoring ? 'Restoring…' : 'Restore'}
        </button>
        <button
          onClick={onDelete}
          disabled={restoring || deleting}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', borderRadius: '6px', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)', color: '#f85149', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: deleting ? 0.6 : 1 }}
        >
          <Trash2 size={13} />
          {deleting ? 'Deleting…' : 'Delete forever'}
        </button>
      </div>
    </div>
  );
};
