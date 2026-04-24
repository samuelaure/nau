import React from 'react';
import { Mail, Send, MessageSquare, Target, Search, Zap, ShoppingBag } from 'lucide-react';
import type { CampaignStats, Lead, TenantStats } from '../../types';
import { StatCard } from '../ui/StatCard';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';

interface OverviewProps {
  stats: CampaignStats[];
  tenantStats: TenantStats | null;
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  resolveHandover: (id: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({
  stats,
  tenantStats,
  leads,
  onSelectLead,
  resolveHandover,
}) => {
  const totalMetrics = stats.reduce(
    (acc, curr) => ({
      totalContacts: acc.totalContacts + (curr.metrics.totalContacts || 0),
      delivered: acc.delivered + (curr.metrics.delivered || 0),
      read: acc.read + (curr.metrics.read || 0),
      replied: acc.replied + (curr.metrics.replied || 0),
      interested: acc.interested + (curr.metrics.interested || 0),
      conversions: acc.conversions + (curr.metrics.conversions || 0),
      blocked: acc.blocked + (curr.metrics.blocked || 0),
    }),
    {
      totalContacts: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      interested: 0,
      conversions: 0,
      blocked: 0,
    }
  );

  return (
    <>
      <div
        className="stats-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        <StatCard
          label="AI Efficiency"
          value={tenantStats?.aiHandledLeads || 0}
          trend={`${tenantStats?.pendingHandover || 0} pending handover`}
          trendColor={
            tenantStats?.pendingHandover && tenantStats.pendingHandover > 0
              ? 'var(--warning)'
              : 'var(--success)'
          }
          icon={<Zap size={16} color="var(--primary)" />}
        />
        <StatCard
          label="Pending Orders"
          value={(tenantStats?.draftOrders || 0) + (tenantStats?.pendingOrders || 0)}
          trend={`${tenantStats?.totalPendingValue || 0} EUR total value`}
          trendColor="var(--accent)"
          icon={<ShoppingBag size={16} color="var(--accent)" />}
        />
        <StatCard
          label="Replied"
          value={totalMetrics.replied}
          trend={`${((totalMetrics.replied / (totalMetrics.read || 1)) * 100).toFixed(1)}% reply rate`}
          trendColor="var(--accent)"
          icon={<MessageSquare size={16} color="var(--accent)" />}
        />
        <StatCard
          label="Read (Opens)"
          value={totalMetrics.read}
          trend={`${((totalMetrics.read / (totalMetrics.delivered || 1)) * 100).toFixed(1)}% open rate`}
          trendColor="var(--primary)"
          icon={<Send size={16} color="var(--primary)" />}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '2rem',
          marginBottom: '2rem',
        }}
      >
        {/* Lead State Segmentation */}
        <div>
          <h2 style={{ marginBottom: '1rem', color: 'var(--primary)', fontSize: '1.25rem' }}>
            Lead Segmentation
          </h2>
          <div
            className="stats-grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}
          >
            <StatCard
              label="COLD"
              value={leads.filter((l) => l.state === 'COLD').length}
              icon={<Target size={14} color="#94a3b8" />}
            />
            <StatCard
              label="INTERESTED"
              value={leads.filter((l) => l.state === 'INTERESTED').length}
              icon={<MessageSquare size={14} color="var(--accent)" />}
            />
            <StatCard
              label="DEMO"
              value={leads.filter((l) => l.state === 'DEMO').length}
              icon={<Search size={14} color="var(--primary)" />}
            />
            <StatCard
              label="NURTURING"
              value={leads.filter((l) => l.state === 'NURTURING').length}
              icon={<Mail size={14} color="#f59e0b" />}
            />
          </div>
        </div>

        {/* Recent Orders */}
        <div className="leads-container" style={{ maxHeight: '280px' }}>
          <div className="leads-header" style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '1rem' }}>Last AI Orders</h3>
          </div>
          <div style={{ padding: '0.5rem 1rem' }}>
            {tenantStats?.recentOrders && tenantStats.recentOrders.length > 0 ? (
              tenantStats.recentOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{order.leadName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ color: 'var(--success)', fontWeight: 700 }}>{order.amount}€</div>
                </div>
              ))
            ) : (
              <div
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  marginTop: '1rem',
                }}
              >
                No orders yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="leads-container">
        <div className="leads-header">
          <h2>Recent Interactions</h2>
          <div className="search-box">
            <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
            <input
              type="text"
              placeholder="Search leads..."
              style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none' }}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Status</th>
              <th>Campaign Stage</th>
              <th>Tokens/Tags</th>
              <th>Last Seen</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{lead.name || 'Unknown Lead'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {lead.phoneNumber}
                  </div>
                </td>
                <td>
                  <Badge variant={lead.status}>{lead.status}</Badge>
                </td>
                <td>
                  <Badge variant={lead.state}>
                    {lead.currentStage?.name || lead.state.replace('_', ' ')}
                  </Badge>
                </td>
                <td>
                  {lead.tags.map((tag) => (
                    <Tag key={tag.name}>{tag.name}</Tag>
                  ))}
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  {new Date(lead.lastInteraction).toLocaleTimeString()}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="secondary"
                      title="View Chat"
                      onClick={() => onSelectLead(lead)}
                    >
                      <MessageSquare size={14} />
                    </button>
                    {lead.status === 'HANDOVER' && (
                      <button onClick={() => resolveHandover(lead.id)}>Resolve</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
