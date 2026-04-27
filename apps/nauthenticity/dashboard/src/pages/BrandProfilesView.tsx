import { useState } from 'react';
import { BrandMonitoredView } from './BrandMonitoredView';
import { BrandBenchmarkView } from './BrandBenchmarkView';
import { BrandOwnedView } from './BrandOwnedView';
import { Users } from 'lucide-react';

type Tab = 'monitored' | 'benchmark' | 'owned';

export const BrandProfilesView = () => {
  const [activeTab, setActiveTab] = useState<Tab>('owned');

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={28} /> Social Profiles
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Manage the Instagram profiles tracked for this brand.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
        {(['owned', 'monitored', 'benchmark'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.6rem 1.4rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'monitored' ? 'Monitored' : tab === 'benchmark' ? 'Benchmark' : 'Owned'}
          </button>
        ))}
      </div>

      {activeTab === 'owned' && <BrandOwnedView />}
      {activeTab === 'monitored' && <BrandMonitoredView />}
      {activeTab === 'benchmark' && <BrandBenchmarkView />}
    </div>
  );
};
