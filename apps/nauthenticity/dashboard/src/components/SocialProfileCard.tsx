import React from 'react';
import { ExternalLink, Trash2, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProfileImageUrl } from '../lib/api';

interface SocialProfileCardProps {
  profile: {
    id: string;
    platform: string;
    username: string;
    profileImageUrl: string | null;
    lastScrapedAt: string;
    _count?: {
      posts: number;
    };
  };
  onSelect: (username: string) => void;
  onDelete?: (id: string) => Promise<void>;
  brandId?: string;
  workspaceId?: string;
}

export const SocialProfileCard = ({
  profile,
  onSelect,
  onDelete,
  brandId,
  workspaceId,
}: SocialProfileCardProps) => {
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm(`Delete profile @${profile.username}?`)) return;

    setDeletingId(profile.id);
    try {
      await onDelete(profile.id);
    } finally {
      setDeletingId(null);
    }
  };

  const postCount = profile._count?.posts || 0;
  const lastScraped = new Date(profile.lastScrapedAt).toLocaleDateString();

  const handleSelect = () => {
    if (brandId && workspaceId) {
      navigate(`/workspaces/${workspaceId}/brands/${brandId}/profiles/${profile.username}`);
    } else {
      onSelect(profile.username);
    }
  };

  return (
    <div
      onClick={handleSelect}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '1.5rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#58a6ff';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 10px rgba(88, 166, 255, 0.2)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Profile Header with Image, Username, and External Link */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Profile Image */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            padding: '2px',
            background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={getProfileImageUrl(profile.profileImageUrl, profile.platform || 'instagram')}
            alt={profile.username}
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              backgroundColor: 'var(--card-bg)',
              padding: profile.profileImageUrl ? '0' : '12px',
              objectFit: 'cover',
            }}
          />
        </div>

        {/* Username and Link */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              @{profile.username}
            </h3>
            <a
              href={`https://${profile.platform === 'instagram' ? 'instagram' : 'instagram'}.com/${profile.username}`}
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#58a6ff',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
              title="View on Instagram"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={14} />
            </a>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {profile.platform}
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <div
          style={{
            flex: 1,
            padding: '0.75rem',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
            Posts
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#58a6ff' }}>
            {postCount}
          </p>
        </div>
        <div
          style={{
            flex: 1,
            padding: '0.75rem',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
            Last Synced
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#58a6ff' }}>
            {lastScraped}
          </p>
        </div>
      </div>

      {/* View Content Button and Delete */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        <button
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            background: '#58a6ff',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#3b92ff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#58a6ff';
          }}
          onClick={(e) => e.stopPropagation()}
        >
          View Content
        </button>

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={deletingId === profile.id}
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              background: 'rgba(255, 0, 0, 0.2)',
              color: '#ff6b6b',
              border: '1px solid #ff6b6b',
              cursor: deletingId === profile.id ? 'not-allowed' : 'pointer',
              opacity: deletingId === profile.id ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title="Delete profile"
          >
            {deletingId === profile.id ? (
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
