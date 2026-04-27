import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Check, Globe } from 'lucide-react';

type Brand = { id: string; name: string };
type Workspace = { id: string; name: string; brands: Brand[] };

export function BrandSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);

  const workspaceMatch = location.pathname.match(/\/workspaces\/([^/]+)/);
  const brandMatch = location.pathname.match(/\/workspaces\/([^/]+)\/brands\/([^/]+)/);

  const activeWorkspaceId = workspaceMatch ? workspaceMatch[1] : localStorage.getItem('nau_workspace_id');
  const activeBrandId = brandMatch ? brandMatch[2] : null;

  useEffect(() => {
    if (activeWorkspaceId) {
      fetch(`/api/v1/workspaces/${activeWorkspaceId}/brands`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : []))
        .then((brands: Brand[]) => {
          const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
          if (workspace) {
            setWorkspaces((ws) =>
              ws.map((w) => (w.id === activeWorkspaceId ? { ...w, brands } : w))
            );
          } else {
            setWorkspaces((ws) => [...ws, { id: activeWorkspaceId, name: '', brands }]);
          }
        })
        .catch(() => {});
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeBrand = activeWorkspace?.brands.find((b) => b.id === activeBrandId);
  const label = activeBrand ? activeBrand.name : activeWorkspace ? 'All Brands' : 'Select Brand';

  const handleSelect = (brandId: string | null) => {
    setOpen(false);
    if (brandId && activeWorkspaceId) {
      navigate(`/workspaces/${activeWorkspaceId}/brands/${brandId}/content`);
    } else if (activeWorkspaceId) {
      navigate(`/workspaces/${activeWorkspaceId}/brands`);
    }
  };

  if (!activeWorkspaceId || !activeWorkspace) return null;

  return (
    <div ref={ref} style={{ marginBottom: '1rem' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.75rem 0.75rem',
          borderRadius: '6px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: 'white',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.08)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      >
        <Globe size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            zIndex: 100,
            background: 'var(--card-bg)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <button
            onClick={() => handleSelect(null)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              color: activeBrandId ? 'var(--text-secondary)' : 'white',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: activeBrandId ? 400 : 600,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            All Brands
          </button>

          {activeWorkspace.brands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => handleSelect(brand.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.5rem 1rem 0.5rem 2rem',
                background: 'transparent',
                border: 'none',
                color: activeBrandId === brand.id ? 'white' : 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: activeBrandId === brand.id ? 600 : 400,
                transition: 'background 0.2s',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {brand.name}
              {activeBrandId === brand.id && (
                <Check
                  size={13}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#58a6ff',
                  }}
                />
              )}
            </button>
          ))}

          {activeWorkspace.brands.length === 0 && (
            <div
              style={{
                padding: '0.75rem 1rem',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              No brands in this workspace.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
