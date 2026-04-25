'use client';

import { useState, useEffect } from 'react';
import { Building2, Globe, ChevronDown, Plus, X, Loader2 } from 'lucide-react';

type NauBrand = { id: string; name: string; timezone?: string };
type NauWorkspace = { id: string; name: string; role: string; brands: NauBrand[] };

import { getWorkspaces, createWorkspace } from '../lib/actions';

export default function WorkspaceContextPanel({
  onContextChange,
}: {
  onContextChange?: (workspaceId: string | null, brandId: string | null) => void;
}) {
  const [workspaces, setWorkspaces] = useState<NauWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    getWorkspaces().then((data) => {
      setWorkspaces(data);
      if (data.length > 0 && !activeWorkspaceId) {
        setActiveWorkspaceId(data[0].id);
      }
    });
  }, [activeWorkspaceId]);

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    setCreateError(null);
    const res = await createWorkspace(newName.trim());
    if (res.success && res.data) {
      const ws = { ...res.data, brands: res.data.brands ?? [] };
      setWorkspaces((all) => [...all, ws]);
      setActiveWorkspaceId(ws.id);
      onContextChange?.(ws.id, null);
      setCreating(false);
      setNewName('');
      setOpen(false);
    } else {
      setCreateError(res.error ?? 'Failed to create workspace');
    }
    setSaving(false);
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeBrand = activeWorkspace?.brands.find((b) => b.id === activeBrandId);

  const handleSelect = (workspaceId: string, brandId: string | null) => {
    setActiveWorkspaceId(workspaceId);
    setActiveBrandId(brandId);
    setOpen(false);
    onContextChange?.(workspaceId, brandId);
  };

  const label = activeBrand
    ? `${activeWorkspace?.name} / ${activeBrand.name}`
    : activeWorkspace
      ? `${activeWorkspace.name} / All Brands`
      : 'Select Context';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--surface)',
          border: '1px solid var(--border-glass)',
          borderRadius: '8px',
          padding: '8px 14px',
          cursor: 'pointer',
          color: 'var(--text)',
          fontSize: '0.85rem',
          fontWeight: 500,
        }}
      >
        <Globe size={14} style={{ color: 'var(--text-dim)' }} />
        <span>{label}</span>
        <ChevronDown size={12} style={{ color: 'var(--text-dim)' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '42px',
            left: 0,
            zIndex: 50,
            background: 'var(--surface)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '8px 0',
            minWidth: '260px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {workspaces.map((ws) => (
            <div key={ws.id}>
              <button
                onClick={() => handleSelect(ws.id, null)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: activeWorkspaceId === ws.id ? 'var(--primary)' : 'var(--text)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                <Building2 size={14} />
                {ws.name}
              </button>
              {ws.brands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelect(ws.id, b.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 16px 6px 38px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: activeBrandId === b.id ? 'var(--text)' : 'var(--text-dim)',
                    fontSize: '0.82rem',
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          ))}
          {workspaces.length === 0 && !creating && (
            <p style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
              No workspaces found.
            </p>
          )}

          <div style={{ borderTop: '1px solid var(--border-glass)', padding: '6px 0' }}>
            {creating ? (
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') {
                      setCreating(false);
                      setNewName('');
                      setCreateError(null);
                    }
                  }}
                  placeholder="Workspace name"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: 'var(--text)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
                {createError && (
                  <span style={{ fontSize: '0.75rem', color: '#f85149' }}>{createError}</span>
                )}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setCreating(false);
                      setNewName('');
                      setCreateError(null);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border-glass)',
                      background: 'transparent',
                      color: 'var(--text-dim)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={12} />
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !newName.trim()}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'var(--primary)',
                      border: 'none',
                      color: 'white',
                      fontSize: '0.75rem',
                      cursor: saving || !newName.trim() ? 'not-allowed' : 'pointer',
                      opacity: saving || !newName.trim() ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {saving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Plus size={14} /> Create workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
