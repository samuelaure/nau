import React from 'react';
import { BarChart3, Mail, Send, MessageSquare, Target, UserCheck, Search } from 'lucide-react';
import type { CampaignStats, Lead } from '../../types';
import { StatCard } from '../ui/StatCard';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';

interface OverviewProps {
    stats: CampaignStats[];
    leads: Lead[];
    onSelectLead: (lead: Lead) => void;
    resolveHandover: (id: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({
    stats,
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
                    label="Total Outbound"
                    value={totalMetrics.totalContacts}
                    trend="Leads imported"
                    icon={<BarChart3 size={16} color="var(--primary)" />}
                />
                <StatCard
                    label="Delivered"
                    value={totalMetrics.delivered}
                    trend={`${((totalMetrics.delivered / (totalMetrics.totalContacts || 1)) * 100).toFixed(1)}% reach`}
                    trendColor="var(--success)"
                    icon={<Mail size={16} color="var(--success)" />}
                />
                <StatCard
                    label="Read (Opens)"
                    value={totalMetrics.read}
                    trend={`${((totalMetrics.read / (totalMetrics.delivered || 1)) * 100).toFixed(1)}% open rate`}
                    trendColor="var(--primary)"
                    icon={<Send size={16} color="var(--primary)" />}
                />
                <StatCard
                    label="Replied"
                    value={totalMetrics.replied}
                    trend={`${((totalMetrics.replied / (totalMetrics.read || 1)) * 100).toFixed(1)}% reply rate`}
                    trendColor="var(--accent)"
                    icon={<MessageSquare size={16} color="var(--accent)" />}
                />
                <StatCard
                    label="Interested"
                    value={totalMetrics.interested}
                    trend="High potential"
                    icon={<Target size={16} color="var(--accent)" />}
                />
                <StatCard
                    label="Converted"
                    value={totalMetrics.conversions}
                    trend={`${((totalMetrics.conversions / (totalMetrics.totalContacts || 1)) * 100).toFixed(1)}% success`}
                    trendColor="var(--success)"
                    icon={<UserCheck size={16} color="var(--success)" />}
                />
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
