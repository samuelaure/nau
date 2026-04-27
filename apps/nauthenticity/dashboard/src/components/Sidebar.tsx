import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { clearToken } from '../lib/auth';
import { BrandSwitcher } from './BrandSwitcher';
import {
  LayoutDashboard,
  Lightbulb,
  Users,
  MessageSquare,
  BarChart2,
  LogOut,
  ChevronDown,
  Check,
  Plus,
  X,
  Loader,
  Video,
  Building2,
  Settings,
  ArrowLeft,
} from 'lucide-react';

type Workspace = { id: string; name: string };

function WorkspaceSelector() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [activeId, setActiveId] = useState<string | null>(() =>
    localStorage.getItem('nau_workspace_id'),
  );

  const active = workspaces.find((w) => w.id === activeId);

  useEffect(() => {
    fetch('/api/v1/workspaces', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Workspace[]) => {
        setWorkspaces(data);
        if (!activeId && data.length > 0) {
          setActiveId(data[0].id);
          localStorage.setItem('nau_workspace_id', data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const select = (id: string) => {
    setActiveId(id);
    localStorage.setItem('nau_workspace_id', id);
    setOpen(false);
    navigate(`/workspaces/${id}/brands`);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/workspaces', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created: Workspace = await res.json();
      setWorkspaces((ws) => [...ws, created]);
      select(created.id);
      setCreating(false);
      setNewName('');
    } catch (e) {
      console.error('[WorkspaceSelector] create error', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} className="sidebar-workspace-selector">
      <button className="sidebar-workspace-btn" onClick={() => setOpen((o) => !o)}>
        <span className="sidebar-workspace-name">{active?.name ?? 'Select workspace'}</span>
        <ChevronDown size={14} className="sidebar-workspace-chevron" />
      </button>

      {open && (
        <div className="sidebar-dropdown">
          <button
            onClick={() => {
              navigate('/workspaces');
              setOpen(false);
            }}
            className="sidebar-dropdown-item"
          >
            <span>All Workspaces</span>
          </button>

          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => select(ws.id)}
              className={`sidebar-dropdown-item${ws.id === activeId ? ' sidebar-dropdown-item--active' : ''}`}
            >
              <span>{ws.name}</span>
              {ws.id === activeId && <Check size={13} className="sidebar-dropdown-check" />}
            </button>
          ))}

          <div className="sidebar-dropdown-divider">
            {creating ? (
              <div className="sidebar-create-form">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  placeholder="Workspace name"
                  className="sidebar-create-input"
                />
                <div className="sidebar-create-actions">
                  <button
                    onClick={() => { setCreating(false); setNewName(''); }}
                    className="sidebar-create-cancel"
                  >
                    <X size={12} />
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !newName.trim()}
                    className="sidebar-create-submit"
                  >
                    {saving ? <Loader size={11} className="spin" /> : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className="sidebar-dropdown-item sidebar-dropdown-item--create">
                <Plus size={14} /> New workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const brandMatch = location.pathname.match(/\/workspaces\/([^/]+)\/brands\/([^/]+)/);
  const workspaceMatch = location.pathname.match(/\/workspaces\/([^/]+)/);

  const activeWorkspaceId = workspaceMatch
    ? workspaceMatch[1]
    : localStorage.getItem('nau_workspace_id');
  const activeBrandId = brandMatch ? brandMatch[2] : null;

  const handleSignOut = () => {
    clearToken();
    window.location.href = '/';
  };

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Video size={18} color="white" />
        </div>
        <span className="sidebar-logo-text">naŭthenticity</span>
      </div>

      <WorkspaceSelector />

      <BrandSwitcher />

      <nav className="sidebar-nav">
        {activeBrandId && activeWorkspaceId ? (
          <>
            <span className="sidebar-section-label">Brand Pages</span>

            {[
              { label: 'Content', to: `/workspaces/${activeWorkspaceId}/brands/${activeBrandId}/content`, icon: LayoutDashboard },
              { label: 'Inspo', to: `/workspaces/${activeWorkspaceId}/brands/${activeBrandId}/inspo`, icon: Lightbulb },
              { label: 'Social Profiles', to: `/workspaces/${activeWorkspaceId}/brands/${activeBrandId}/profiles`, icon: Users },
              { label: 'Comments', to: `/workspaces/${activeWorkspaceId}/brands/${activeBrandId}/comments`, icon: MessageSquare },
              { label: 'Benchmark', to: `/workspaces/${activeWorkspaceId}/brands/${activeBrandId}/benchmark`, icon: BarChart2 },
            ].map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`sidebar-link${isActive(to) ? ' sidebar-link--active' : ''}`}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </>
        ) : activeWorkspaceId ? (
          <>
            <span className="sidebar-section-label">Workspace</span>
            {[
              { label: 'Brands', to: `/workspaces/${activeWorkspaceId}/brands`, icon: Building2 },
              { label: 'Settings', to: '/workspace-settings', icon: Settings },
            ].map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`sidebar-link${isActive(to) ? ' sidebar-link--active' : ''}`}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </>
        ) : (
          <Link to="/workspaces" className={`sidebar-link${isActive('/workspaces') ? ' sidebar-link--active' : ''}`}>
            <Building2 size={17} /> Workspaces
          </Link>
        )}
      </nav>

      <button className="sidebar-signout" onClick={handleSignOut}>
        <LogOut size={17} /> Sign Out
      </button>
    </aside>
  );
}
