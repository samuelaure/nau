import React, { useState, useEffect } from 'react';
import { FeatureHeader } from '../ui/FeatureHeader';
import { TrendingUp, Users, Target, CheckCircle } from 'lucide-react';

interface AnalyticsData {
  campaignId: string;
  name: string;
  metrics: {
    totalContacts: number;
    delivered: number;
    read: number;
    replied: number;
    interested: number;
    conversions: number;
  };
}

export const AnalyticsView: React.FC = () => {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      setData(stats);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading Analytics...</div>;

  const aggregate = data.reduce(
    (acc, curr) => ({
      total: acc.total + curr.metrics.totalContacts,
      delivered: acc.delivered + curr.metrics.delivered,
      read: acc.read + curr.metrics.read,
      replied: acc.replied + curr.metrics.replied,
      interested: acc.interested + curr.metrics.interested,
      conversions: acc.conversions + curr.metrics.conversions,
    }),
    { total: 0, delivered: 0, read: 0, replied: 0, interested: 0, conversions: 0 }
  );

  const getConversion = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return (current / previous) * 100;
  };

  return (
    <div className="feature-container">
      <FeatureHeader
        title="Predictive Analytics"
        description="Stage-by-stage funnel conversion and campaign performance"
      />

      {/* Funnel Visualization */}
      <div
        className="glass-card"
        style={{
          padding: '2rem',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '16px',
          marginBottom: '2rem',
        }}
      >
        <h3 style={{ marginBottom: '2rem', color: 'var(--primary)' }}>Master Conversion Funnel</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Step 1: Delivery */}
          <FunnelStep
            label="Delivery Rate"
            value={aggregate.delivered}
            total={aggregate.total}
            percentage={getConversion(aggregate.delivered, aggregate.total)}
            color="#667eea"
            icon={<TrendingUp size={16} />}
          />

          {/* Step 2: Open/Read */}
          <FunnelStep
            label="Open Rate"
            value={aggregate.read}
            total={aggregate.delivered}
            percentage={getConversion(aggregate.read, aggregate.delivered)}
            color="#764ba2"
            icon={<Users size={16} />}
          />

          {/* Step 3: Response */}
          <FunnelStep
            label="Response Rate"
            value={aggregate.replied}
            total={aggregate.read}
            percentage={getConversion(aggregate.replied, aggregate.read)}
            color="#f6ad55"
            icon={<Target size={16} />}
          />

          {/* Step 4: Conversion */}
          <FunnelStep
            label="Final Conversion"
            value={aggregate.conversions}
            total={aggregate.replied}
            percentage={getConversion(aggregate.conversions, aggregate.replied)}
            color="#48bb78"
            icon={<CheckCircle size={16} />}
          />
        </div>
      </div>

      {/* Comparison Grid */}
      <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>
        Campaign Performance Breakdown
      </h3>
      <div className="stats-grid">
        {data.map((campaign) => (
          <div key={campaign.campaignId} className="stat-card">
            <h4 style={{ color: 'white', marginBottom: '1rem' }}>{campaign.name}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}
              >
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Leads:</span>
                <span>{campaign.metrics.totalContacts}</span>
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}
              >
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Interested:</span>
                <span style={{ color: 'var(--accent)' }}>{campaign.metrics.interested}</span>
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}
              >
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Conversions:</span>
                <span style={{ color: 'var(--success)' }}>{campaign.metrics.conversions}</span>
              </div>
              <div
                style={{
                  marginTop: '0.5rem',
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                }}
              >
                <div
                  style={{
                    width: `${getConversion(campaign.metrics.conversions, campaign.metrics.totalContacts)}%`,
                    height: '100%',
                    background: 'var(--success)',
                    borderRadius: '2px',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FunnelStep = ({ label, value, total, percentage, color, icon }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
    <div
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: `${color}22`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 600, color: 'white' }}>{label}</span>
        <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
          {value} / {total}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            flex: 1,
            height: '10px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '5px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${color}dd, ${color})`,
              borderRadius: '5px',
            }}
          />
        </div>
        <span style={{ minWidth: '50px', fontWeight: 700, color, textAlign: 'right' }}>
          {percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  </div>
);
