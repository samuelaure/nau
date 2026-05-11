import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { updateProject } from '../lib/api';
import { Save } from 'lucide-react';

export const ProjectSettingsView = () => {
  const { projectId, workspaceId } = useParams<{ projectId: string; workspaceId: string }>();
  const queryClient = useQueryClient();

  // Read from the overview cache to avoid an extra endpoint
  const overview = queryClient.getQueryData<{ brands: any[]; projects: any[] }>(['workspace-overview', workspaceId]);
  const project = overview?.projects?.find((p: any) => p.id === projectId);

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateProject(projectId!, { name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-overview', workspaceId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div style={{ maxWidth: '520px' }}>
      <h2 style={{ borderBottom: 'none', marginBottom: '1.5rem' }}>Project Settings</h2>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8b949e' }}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8b949e' }}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional description…"
          style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      <button
        className="btn-primary"
        disabled={mutation.isPending || !name.trim()}
        onClick={() => mutation.mutate()}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <Save size={16} />
        {saved ? 'Saved!' : mutation.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
};
