import { useEffect, useState } from 'react';
import {
  Users,
  Target,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  MessageSquare,
  X,
  ShieldAlert,
  Clock
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

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  timestamp: string;
  status: string;
}

function App() {
  const [stats, setStats] = useState<CampaignStats[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [keywords, setKeywords] = useState<{ id: string; word: string; type: string }[]>([]);
  const [availability, setAvailability] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [kwType, setKwType] = useState('INTERNAL');
  const [loading, setLoading] = useState(true);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const baseUrl = 'http://localhost:3000/api/dashboard';
      const [statsRes, leadsRes, keywordsRes, configRes] = await Promise.all([
        fetch(`${baseUrl}/stats`),
        fetch(`${baseUrl}/leads`),
        fetch(`${baseUrl}/config/keywords`),
        fetch(`${baseUrl}/config/global`)
      ]);

      const statsData = await statsRes.json();
      const leadsData = await leadsRes.json();
      const keywordsData = await keywordsRes.json();
      const configData = await configRes.json();

      setStats(statsData);
      setLeads(leadsData);
      setKeywords(keywordsData);
      setAvailability(configData.availabilityStatus || '');
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAvailability = async () => {
    setIsSavingStatus(true);
    try {
      await fetch('http://localhost:3000/api/dashboard/config/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilityStatus: availability })
      });
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsSavingStatus(false);
    }
  };

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    try {
      const res = await fetch('http://localhost:3000/api/dashboard/config/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newKeyword, type: kwType })
      });
      if (res.ok) {
        setNewKeyword('');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to add keyword:', error);
    }
  };

  const removeKeyword = async (id: string) => {
    try {
      await fetch(`http://localhost:3000/api/dashboard/config/keywords/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to remove keyword:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async (leadId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dashboard/leads/${leadId}/messages`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  useEffect(() => {
    let interval: any;
    if (selectedLead) {
      fetchMessages(selectedLead.id);
      interval = setInterval(() => fetchMessages(selectedLead.id), 5000);
    }
    return () => clearInterval(interval);
  }, [selectedLead]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !newMessage.trim()) return;
    setIsSendingMsg(true);
    try {
      await fetch(`http://localhost:3000/api/dashboard/leads/${selectedLead.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage })
      });
      setNewMessage('');
      fetchMessages(selectedLead.id);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSendingMsg(false);
    }
  };

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
        <div className="settings-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Clock size={20} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Availability Status</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Personalize AI responses while leads wait for you. Describe what you're doing.
          </p>
          <div className="keyword-form">
            <input
              type="text"
              placeholder="e.g. 'en una reunión hasta las 16:00'..."
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            />
            <button onClick={updateAvailability} disabled={isSavingStatus}>
              {isSavingStatus ? 'Saving...' : 'Save Status'}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <ShieldAlert size={20} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Handover Triggers</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Define logic-based triggers for human intervention.
          </p>

          <form onSubmit={addKeyword} className="keyword-form">
            <select
              value={kwType}
              onChange={(e) => setKwType(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: '#fff', borderRadius: '0.75rem', padding: '0 0.5rem' }}
            >
              <option value="INTERNAL">Owner Trigger</option>
              <option value="LEAD">Lead Request</option>
            </select>
            <input
              type="text"
              placeholder="Phrase..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>

          <div className="keyword-list">
            {keywords.map((k) => (
              <div key={k.id} className="keyword-pill" style={{ borderColor: k.type === 'INTERNAL' ? 'var(--primary-glow)' : 'var(--accent)' }}>
                <span style={{ fontSize: '0.65rem', opacity: 0.5, marginRight: '4px' }}>{k.type}:</span> {k.word}
                <button onClick={() => removeKeyword(k.id)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedLead && (
        <div className="modal-overlay">
          <div className="chat-modal">
            <div className="chat-header">
              <div>
                <h3>{selectedLead.name || 'Chat with Lead'}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedLead.phoneNumber}</p>
              </div>
              <button className="secondary" onClick={() => setSelectedLead(null)}><X size={18} /></button>
            </div>
            <div className="chat-messages">
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.direction.toLowerCase()}`}>
                  <div className="message-content">
                    {m.content}
                    <div className="message-meta">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {m.direction === 'OUTBOUND' && <span className={`status-${m.status || 'sent'}`}> • {m.status || 'sent'}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="chat-input">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isSendingMsg}
              />
              <button type="submit" disabled={isSendingMsg || !newMessage.trim()}>
                {isSendingMsg ? '...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="leads-container">
        <div className="leads-header">
          <h2>Recent Interactions</h2>
          <div className="search-box">
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="secondary" title="View Chat" onClick={() => setSelectedLead(lead)}>
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
    </div>
  );
}

export default App;
