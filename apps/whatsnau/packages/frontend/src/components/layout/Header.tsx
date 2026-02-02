import { RefreshCw } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  loading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, loading, onRefresh }) => {
  const getTitle = () => {
    const titles: Record<string, string> = {
      overview: 'Overview',
      analytics: 'Analytics',
      broadcast: 'Broadcast',
      import: 'Lead Import',
      campaign: 'Sequence Flow',
      settings: 'AI Agents',
      templates: 'Meta Templates',
      campaigns: 'Campaign Manager',
    };
    return titles[activeTab] || 'Dashboard';
  };

  return (
    <header style={{ marginBottom: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{getTitle()}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {activeTab === 'overview' ? 'Real-time performance metrics' : 'Campaign Orchestration'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button className="secondary" onClick={onRefresh} disabled={loading}>
          <RefreshCw
            size={16}
            style={{
              marginRight: '8px',
              verticalAlign: 'middle',
              animation: loading ? 'spin 2s linear infinite' : 'none',
            }}
          />
          Sync Data
        </button>
      </div>
    </header>
  );
};
