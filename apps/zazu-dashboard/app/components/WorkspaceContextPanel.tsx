'use client';

import { useState, useEffect } from 'react';
import { Building2, Globe, ChevronDown } from 'lucide-react';

type NauBrand = { id: string; name: string; timezone?: string };
type NauWorkspace = { id: string; name: string; role: string; brands: NauBrand[] };

const NAU_API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NAU_API_URL) || 'https://api.9nau.com';

export default function WorkspaceContextPanel({
  onContextChange,
}: {
  onContextChange?: (workspaceId: string | null, brandId: string | null) => void;
}) {
  const [workspaces, setWorkspaces] = useState<NauWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${NAU_API_URL}/workspaces`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NauWorkspace[]) => {
        setWorkspaces(data);
        if (data.length > 0) setActiveWorkspaceId(data[0].id);
      })
      .catch(() => {});
  }, []);

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
          {workspaces.length === 0 && (
            <p style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
              No workspaces found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
