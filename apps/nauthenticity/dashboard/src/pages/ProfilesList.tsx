import { useQuery } from '@tanstack/react-query';
import { getProfiles, getMediaUrl, API_URL } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AddAccountForm } from '../components/AddAccountForm';

export const ProfilesList = () => {
  const navigate = useNavigate();
  const {
    data: profiles,
    isLoading,
    isError,
    error,
  } = useQuery({ queryKey: ['profiles'], queryFn: getProfiles });

  if (isLoading) return <div>Loading...</div>;
  if (isError)
    return (
      <div style={{ color: 'red', padding: '1rem' }}>
        Error loading profiles: {(error as Error).message}. Check if backend is running on {API_URL}
      </div>
    );

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
        <h2 style={{ borderBottom: 'none' }}>Social Profiles</h2>
        <AddAccountForm />
      </div>

      <div className="accounts-grid">
        {Array.isArray(profiles) &&
          profiles.map((profile) => (
            <div
              key={profile.username}
              className="account-card fade-in"
              onClick={() => navigate(`/profiles/${profile.username}`)}
            >
              <div className="profile-header">
                <img
                  src={getMediaUrl(profile.profileImageUrl ?? undefined) || 'https://via.placeholder.com/64'}
                  alt={profile.username}
                  className="avatar"
                />
                <div className="profile-info">
                  <h3>@{profile.username}</h3>
                  <span>Updated {formatDistanceToNow(new Date(profile.lastScrapedAt))} ago</span>
                </div>
              </div>
              <div className="stats">
                <div className="stat-item">
                  <span className="stat-value">{profile._count?.posts || 0}</span>
                  <span className="stat-label">Posts</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    <ImageIcon size={14} />
                  </span>
                  <span className="stat-label">Media</span>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
