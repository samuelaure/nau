import React from 'react';
import { RefreshCw, Upload } from 'lucide-react';

interface HeaderProps {
  activeTab:
    | 'overview'
    | 'settings'
    | 'campaign'
    | 'campaigns'
    | 'broadcast'
    | 'templates'
    | 'import';
  setActiveTab: (
    tab: 'overview' | 'settings' | 'campaign' | 'campaigns' | 'broadcast' | 'templates' | 'import'
  ) => void;
  loading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, loading, onRefresh }) => {
  return (
    <header>
      <div>
        <h1 className="logo">whatsnaŭ</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Campaign Orchestration Dashboard
        </p>
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <nav className="tabs">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            AI Agents
          </button>
          <button
            className={activeTab === 'campaign' ? 'active' : ''}
            onClick={() => setActiveTab('campaign')}
          >
            Campaign
          </button>
          <button
            className={activeTab === 'campaigns' ? 'active' : ''}
            onClick={() => setActiveTab('campaigns')}
          >
            Campaigns
          </button>
          <button
            className={activeTab === 'templates' ? 'active' : ''}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
          <button
            className={activeTab === 'broadcast' ? 'active' : ''}
            onClick={() => setActiveTab('broadcast')}
          >
            Broadcast
          </button>
          <button
            className={activeTab === 'import' ? 'active' : ''}
            onClick={() => setActiveTab('import')}
          >
            <Upload size={14} style={{ marginRight: '6px' }} /> Import
          </button>
        </nav>
        <button className="secondary" onClick={onRefresh} disabled={loading}>
          <RefreshCw
            size={16}
            style={{
              marginRight: '8px',
              verticalAlign: 'middle',
              animation: loading ? 'spin 2s linear infinite' : 'none',
            }}
          />
          Refresh
        </button>
      </div>
    </header>
  );
};
