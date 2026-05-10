import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWorkspaceOverview, createBrand, createProject } from '../lib/api';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, FolderOpen, Plus, X } from 'lucide-react';

type ModalType = 'brand' | 'project' | null;

export const BrandsList = () => {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();

  const [modal, setModal] = useState<ModalType>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['workspace-overview', workspaceId],
    queryFn: () => getWorkspaceOverview(workspaceId!),
    enabled: !!workspaceId,
  });

  const brandMutation = useMutation({
    mutationFn: (n: string) => createBrand(workspaceId!, n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-overview', workspaceId] });
      closeModal();
    },
    onError: (err: any) => setError(err?.response?.data?.message || err.message || 'Failed'),
  });

  const projectMutation = useMutation({
    mutationFn: (n: string) => createProject(workspaceId!, n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-overview', workspaceId] });
      closeModal();
    },
    onError: (err: any) => setError(err?.response?.data?.message || err.message || 'Failed'),
  });

  const closeModal = () => { setModal(null); setName(''); setError(''); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required'); return; }
    if (modal === 'brand') brandMutation.mutate(trimmed);
    else if (modal === 'project') projectMutation.mutate(trimmed);
  };

  const isPending = brandMutation.isPending || projectMutation.isPending;

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div style={{ color: 'red', padding: '1rem' }}>Error: {(fetchError as Error).message}</div>;

  const brands = data?.brands ?? [];
  const projects = data?.projects ?? [];

  return (
    <div>
      {/* ── Brands ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ borderBottom: 'none', margin: 0 }}>Brands</h2>
        <button className="btn-primary" onClick={() => setModal('brand')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Brand
        </button>
      </div>

      <div className="accounts-grid" style={{ marginBottom: '2.5rem' }}>
        {brands.map((brand: any) => (
          <div
            key={brand.id}
            className="account-card fade-in"
            onClick={() => navigate(`/workspaces/${workspaceId}/brands/${brand.id}/content`)}
          >
            <div className="profile-header">
              <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', color: '#8b949e', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={20} />
              </div>
              <div className="profile-info">
                <h3 style={{ fontSize: '15px' }}>{brand.name}</h3>
                <span style={{ fontSize: '13px', color: '#8b949e' }}>ID: {brand.id.split('-')[0]}…</span>
              </div>
            </div>
          </div>
        ))}
        {brands.length === 0 && (
          <div style={{ color: '#8b949e', padding: '1rem 0' }}>No brands yet.</div>
        )}
      </div>

      {/* ── Projects ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ borderBottom: 'none', margin: 0 }}>Projects</h2>
        <button className="btn-primary" onClick={() => setModal('project')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="accounts-grid">
        {projects.map((project: any) => (
          <div
            key={project.id}
            className="account-card fade-in"
            onClick={() => navigate(`/workspaces/${workspaceId}/projects/${project.id}/captures`)}
          >
            <div className="profile-header">
              <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', color: '#8b949e', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FolderOpen size={20} />
              </div>
              <div className="profile-info">
                <h3 style={{ fontSize: '15px' }}>{project.name}</h3>
                {project.description && (
                  <span style={{ fontSize: '13px', color: '#8b949e' }}>{project.description}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div style={{ color: '#8b949e', padding: '1rem 0' }}>No projects yet.</div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={closeModal}
        >
          <div
            style={{ background: 'var(--bg-secondary, #161b22)', border: '1px solid var(--border-color, #30363d)', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>New {modal === 'brand' ? 'Brand' : 'Project'}</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8b949e' }}>
                  {modal === 'brand' ? 'Brand' : 'Project'} name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  placeholder={modal === 'brand' ? 'e.g. My Brand' : 'e.g. Abundance Mindset'}
                  autoFocus
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0d1117)', border: `1px solid ${error ? '#f85149' : 'var(--border-color, #30363d)'}`, borderRadius: '6px', color: 'var(--text-primary, #e6edf3)', fontSize: '14px', boxSizing: 'border-box' }}
                />
                {error && <p style={{ color: '#f85149', fontSize: '13px', marginTop: '6px' }}>{error}</p>}
              </div>
              <button type="submit" disabled={isPending} className="btn-primary" style={{ width: '100%' }}>
                {isPending ? 'Creating…' : `Create ${modal === 'brand' ? 'Brand' : 'Project'}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
