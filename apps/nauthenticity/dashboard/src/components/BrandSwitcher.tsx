import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Globe, FolderOpen } from 'lucide-react';
import type { NauProject } from '../lib/api';

type Brand = { id: string; name: string };

const sectionLabel: React.CSSProperties = {
  padding: '0.25rem 1rem',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-secondary)',
  opacity: 0.6,
};

const divider: React.CSSProperties = {
  height: '1px',
  background: 'rgba(255,255,255,0.06)',
  margin: '4px 0',
};

const itemStyle = (active: boolean): React.CSSProperties => ({
  width: '100%',
  textAlign: 'left',
  padding: '0.5rem 1rem 0.5rem 2rem',
  background: 'transparent',
  border: 'none',
  color: active ? 'white' : 'var(--text-secondary)',
  fontSize: '13px',
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
  transition: 'background 0.2s',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

export function BrandSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<NauProject[]>([]);
  const [open, setOpen] = useState(false);

  const workspaceMatch = location.pathname.match(/\/workspaces\/([^/]+)/);
  const brandMatch = location.pathname.match(/\/workspaces\/([^/]+)\/brands\/([^/]+)/);
  const projectMatch = location.pathname.match(/\/workspaces\/([^/]+)\/projects\/([^/]+)/);

  const activeWorkspaceId = workspaceMatch ? workspaceMatch[1] : localStorage.getItem('nau_workspace_id');
  const activeBrandId = brandMatch ? brandMatch[2] : null;
  const activeProjectId = projectMatch ? projectMatch[2] : null;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetch(`/api/v1/workspaces/${activeWorkspaceId}/brands`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Brand[]) => setBrands(data))
      .catch(() => setBrands([]));
    fetch(`/api/v1/workspaces/${activeWorkspaceId}/projects`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NauProject[]) => setProjects(data))
      .catch(() => setProjects([]));
  }, [activeWorkspaceId]);

  const activeBrand = brands.find((b) => b.id === activeBrandId);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const label = activeBrand?.name ?? activeProject?.name ?? 'All Brands/Projects';

  const handleSelectBrand = (brandId: string | null) => {
    setOpen(false);
    if (brandId && activeWorkspaceId) {
      navigate(`/workspaces/${activeWorkspaceId}/brands/${brandId}/content`);
    } else if (activeWorkspaceId) {
      navigate(`/workspaces/${activeWorkspaceId}/brands`);
    }
  };

  const handleSelectProject = (projectId: string) => {
    setOpen(false);
    if (activeWorkspaceId) {
      navigate(`/workspaces/${activeWorkspaceId}/projects/${projectId}/captures`);
    }
  };

  if (!activeWorkspaceId) return null;

  return (
    <div ref={ref} style={{ marginBottom: '1rem', position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          width: '100%', padding: '0.75rem', borderRadius: '6px',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
      >
        {activeProjectId
          ? <FolderOpen size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          : <Globe size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 50,
          background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {/* Workspace overview */}
          <button
            onClick={() => handleSelectBrand(null)}
            style={{
              ...itemStyle(!activeBrandId && !activeProjectId),
              padding: '0.75rem 1rem',
              fontWeight: !activeBrandId && !activeProjectId ? 600 : 400,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            All Brands/Projects
          </button>

          {/* Brands section */}
          {brands.length > 0 && (
            <>
              <div style={divider} />
              <div style={sectionLabel}>Brands</div>
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => handleSelectBrand(brand.id)}
                  style={itemStyle(activeBrandId === brand.id)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Globe size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                  {brand.name}
                </button>
              ))}
            </>
          )}

          {/* Projects section */}
          {projects.length > 0 && (
            <>
              <div style={divider} />
              <div style={sectionLabel}>Projects</div>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  style={itemStyle(activeProjectId === project.id)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <FolderOpen size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                  {project.name}
                </button>
              ))}
            </>
          )}

          {brands.length === 0 && projects.length === 0 && (
            <div style={{ padding: '0.75rem 1rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
              No brands or projects yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
