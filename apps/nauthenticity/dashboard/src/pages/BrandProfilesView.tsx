import { useState } from 'react';
import { BrandMonitoredView } from './BrandMonitoredView';
import { BrandBenchmarkView } from './BrandBenchmarkView';
import { Users, Sparkles, Activity, BarChart2 } from 'lucide-react';

type Tab = 'inspiration' | 'monitored' | 'benchmark';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inspiration', label: 'Inspiration' },
  { id: 'monitored', label: 'Monitored' },
  { id: 'benchmark', label: 'Benchmark' },
];

export const BrandProfilesView = () => {
  const [activeTab, setActiveTab] = useState<Tab>('inspiration');

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
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              padding: '0.6rem 1.4rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === id ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === id ? 600 : 400,
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'inspiration' && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '10px' }}>
          <Sparkles size={32} style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            Inspiration profiles — add full social profiles to your brand's InspoBase. Coming soon.
          </p>
        </div>
      )}
      {activeTab === 'monitored' && <BrandMonitoredView />}
      {activeTab === 'benchmark' && <BrandBenchmarkView />}
    </div>
  );
};
