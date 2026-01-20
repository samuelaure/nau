import { useEffect, useState } from 'react';
import {
  Users,
  Target,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  MessageSquare
} from 'lucide-react';

interface Metric {
  totalContacts: number;
  interested: number;
  conversions: number;
  blocked: number;
  conversionRate: number;
}

interface CampaignStats {
  campaignId: string;
  name: string;
  metrics: Metric;
}

interface Lead {
  id: string;
  phoneNumber: string;
  name: string | null;
  status: string;
  state: string;
  lastInteraction: string;
  tags: { name: string }[];
  currentStage: { name: string } | null;
}

function App() {
  const [stats, setStats] = useState<CampaignStats[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const baseUrl = 'http://localhost:3000/api/dashboard';
      const [statsRes, leadsRes] = await Promise.all([
        fetch(`${baseUrl}/stats`),
        fetch(`${baseUrl}/leads`)
      ]);

      const statsData = await statsRes.json();
      const leadsData = await leadsRes.json();

      setStats(statsData);
      setLeads(leadsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const totalMetrics = stats.reduce((acc, curr) => ({
    totalContacts: acc.totalContacts + curr.metrics.totalContacts,
    interested: acc.interested + curr.metrics.interested,
    conversions: acc.conversions + curr.metrics.conversions,
    blocked: acc.blocked + curr.metrics.blocked,
  }), { totalContacts: 0, interested: 0, conversions: 0, blocked: 0 });

  const resolveHandover = async (id: string) => {
    try {
      await fetch(`http://localhost:3000/api/dashboard/leads/${id}/resolve`, { method: 'POST' });
      fetchData();
    } catch (error) {
      console.error('Failed to resolve handover:', error);
    }
  };

  return (
    <div className="dashboard-container">
      <header>
        <div>
          <h1 className="logo">whatsnaŭ</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Campaign Orchestration Dashboard</p>
        </div>
        <button className="secondary" onClick={fetchData} disabled={loading}>
          <RefreshCw size={16} style={{ marginRight: '8px', verticalAlign: 'middle', animation: loading ? 'spin 2s linear infinite' : 'none' }} />
          Refresh
        </button>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label flex items-center gap-2">
            <Users size={16} color="var(--primary)" /> Total Contacts
          </div>
          <div className="stat-value">{totalMetrics.totalContacts}</div>
          <div className="stat-trend" style={{ color: 'var(--primary)' }}>Active outreach</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Target size={16} color="var(--accent)" /> Interested Leads
          </div>
          <div className="stat-value">{totalMetrics.interested}</div>
          <div className="stat-trend" style={{ color: 'var(--accent)' }}>Ready for demo</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <CheckCircle2 size={16} color="var(--success)" /> Converted
          </div>
          <div className="stat-value">{totalMetrics.conversions}</div>
          <div className="stat-trend" style={{ color: 'var(--success)' }}>Success rate: {((totalMetrics.conversions / (totalMetrics.totalContacts || 1)) * 100).toFixed(1)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <AlertCircle size={16} color="var(--danger)" /> Handover Required
          </div>
          <div className="stat-value" style={{ color: leads.filter(l => l.status === 'HANDOVER').length > 0 ? 'var(--danger)' : 'inherit' }}>
            {leads.filter(l => l.status === 'HANDOVER').length}
          </div>
          <div className="stat-trend">Manual intervention needed</div>
        </div>
      </div>

      <div className="leads-container">
        <div className="leads-header">
          <h2>Recent Interactions</h2>
          <div className="search-box" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--card-border)' }}>
            <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
            <input
              type="text"
              placeholder="Search leads..."
              style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.875rem' }}
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.phoneNumber}</div>
                </td>
                <td>
                  <span className={`badge badge-${lead.status.toLowerCase()}`}>
                    {lead.status}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${lead.state.toLowerCase()}`}>
                    {lead.currentStage?.name || lead.state.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  {lead.tags.map(tag => (
                    <span key={tag.name} className="tag">{tag.name}</span>
                  ))}
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  {new Date(lead.lastInteraction).toLocaleTimeString()}
                </td>
                <td>
                  {lead.status === 'HANDOVER' ? (
                    <button onClick={() => resolveHandover(lead.id)}>Resolve</button>
                  ) : (
                    <button className="secondary" title="View Chat">
                      <MessageSquare size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
