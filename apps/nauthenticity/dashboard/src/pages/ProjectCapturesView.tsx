import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProjectTargets, addProjectTarget, getAccount } from '../lib/api';
import { Plus, BookOpen } from 'lucide-react';
import { PostGrid } from '../components/PostGrid';

export const ProjectCapturesView = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [newUsername, setNewUsername] = useState('');

  const { data: targets, isLoading } = useQuery({
    queryKey: ['project-targets', projectId, 'INSPO'],
    queryFn: () => getProjectTargets(projectId!, 'INSPO'),
    enabled: !!projectId,
  });

  const addMutation = useMutation({
    mutationFn: (username: string) =>
      addProjectTarget({ projectId: projectId!, usernames: [username], category: 'INSPO', isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-targets', projectId] });
      setNewUsername('');
    },
  });

  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

  const { data: profileData } = useQuery({
    queryKey: ['account', selectedUsername],
    queryFn: () => getAccount(selectedUsername!),
    enabled: !!selectedUsername,
  });

  if (isLoading) return <div>Loading captures…</div>;

  const profileTargets: any[] = Array.isArray(targets) ? targets.filter((t: any) => t.socialProfile) : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ borderBottom: 'none', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={20} /> Captures
        </h2>
      </div>

      {/* Add profile */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newUsername.trim()) addMutation.mutate(newUsername.trim()); }}
          placeholder="Add Instagram username…"
          style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px' }}
        />
        <button
          className="btn-primary"
          disabled={!newUsername.trim() || addMutation.isPending}
          onClick={() => newUsername.trim() && addMutation.mutate(newUsername.trim())}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Profile list */}
      {profileTargets.length === 0 ? (
        <p style={{ color: '#8b949e' }}>No captures yet. Add an Instagram profile above.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem' }}>
          {profileTargets.map((t: any) => (
            <button
              key={t.id}
              onClick={() => setSelectedUsername(t.socialProfile?.username === selectedUsername ? null : t.socialProfile?.username)}
              style={{
                padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border-color)',
                background: selectedUsername === t.socialProfile?.username ? 'var(--accent)' : 'var(--bg-secondary)',
                color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              @{t.socialProfile?.username}
            </button>
          ))}
        </div>
      )}

      {/* Posts for selected profile */}
      {selectedUsername && profileData?.posts && (
        <PostGrid posts={profileData.posts} />
      )}
    </div>
  );
};
