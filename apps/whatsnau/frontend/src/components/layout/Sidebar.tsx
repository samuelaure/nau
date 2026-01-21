import React from 'react';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  Layers,
  FileText,
  PlusCircle,
  FolderTree,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import type { CampaignStats } from '../../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  campaigns: CampaignStats[];
  selectedCampaignId: string;
  onSelectCampaign: (id: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  isCollapsed,
  onToggle,
  onLogout,
}) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'broadcast', label: 'Broadcast', icon: MessageSquare },
    { id: 'import', label: 'Import Leads', icon: Users },
  ];

  const workspaceItems = [
    { id: 'campaign', label: 'Flow & Sequence', icon: FolderTree },
    { id: 'settings', label: 'AI Agents', icon: Settings },
    { id: 'templates', label: 'Meta Templates', icon: FileText },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && (
          <div className="logo">
            whatsna<span>ŭ</span>
          </div>
        )}
        <button className="toggle-btn" onClick={onToggle}>
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="sidebar-section">
        {!isCollapsed && <label>Global Workspace</label>}
        <nav>
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={isCollapsed ? item.label : ''}
            >
              <item.icon size={18} />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-section">
        {!isCollapsed && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <label>Campaign Workspaces</label>
          </div>
        )}

        <select
          className="campaign-selector"
          value={selectedCampaignId}
          onChange={(e) => onSelectCampaign(e.target.value)}
          disabled={isCollapsed}
        >
          <option value="">{isCollapsed ? '...' : 'All Campaigns'}</option>
          {campaigns.map((c) => (
            <option key={c.campaignId} value={c.campaignId}>
              {c.name}
            </option>
          ))}
        </select>

        <nav style={{ marginTop: '1rem' }}>
          {workspaceItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={isCollapsed ? item.label : ''}
            >
              <item.icon size={18} />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ))}

          <button
            className={`nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
            style={{ marginTop: 'auto' }}
            title={isCollapsed ? 'Manage Campaigns' : ''}
          >
            <Layers size={18} />
            {!isCollapsed && <span>Manage Campaigns</span>}
          </button>
        </nav>
      </div>

      <div className="sidebar-footer">
        <button className="nav-item" title={isCollapsed ? 'New Campaign' : ''}>
          <PlusCircle size={18} />
          {!isCollapsed && <span>New Campaign</span>}
        </button>
        <button
          className="nav-item danger"
          onClick={onLogout}
          title={isCollapsed ? 'Cerrar Sesión' : ''}
          style={{ marginTop: '0.5rem' }}
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
};
