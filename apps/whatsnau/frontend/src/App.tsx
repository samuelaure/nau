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
  Clock,
  Upload,
  Send,
  Zap
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
  aiEnabled: boolean;
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

interface Opportunity {
  id: string;
  type: string;
  description: string;
  severity: string;
  aiGenerated: boolean;
}

interface StagingLead {
  id: string;
  phoneNumber: string;
  name: string | null;
  cleanseStatus: string;
  isValidWhatsApp: boolean;
  isVerified: boolean;
  opportunities: Opportunity[];
}

interface ImportBatch {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  stagingLeads: StagingLead[];
  _count?: {
    stagingLeads: number;
  };
}

interface Template {
  name: string;
  status: string;
  category: string;
  language: string;
  components: { type: string; text?: string }[];
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
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'campaign' | 'templates' | 'import'>('overview');
  const [business, setBusiness] = useState({ name: '', knowledgeBase: '' });
  const [prompts, setPrompts] = useState<{ role: string; basePrompt: string }[]>([]);
  const [sequences, setSequences] = useState<{ id: string; name: string; waitHours: number; order: number }[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [telegram, setTelegram] = useState({ botToken: '', chatId: '', isEnabled: false });
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');

  const fetchConfig = async () => {
    try {
      const baseUrl = 'http://localhost:3000/api/dashboard/config';
      const [bizRes, promptRes, seqRes, tempRes, teleRes] = await Promise.all([
        fetch(`${baseUrl}/business`),
        fetch(`${baseUrl}/prompts`),
        fetch(`${baseUrl}/sequences`),
        fetch(`${baseUrl}/whatsapp-templates`),
        fetch(`${baseUrl}/telegram`)
      ]);
      setBusiness(await bizRes.json());
      setPrompts(await promptRes.json());
      setSequences(await seqRes.json());
      const tempData = await tempRes.json();
      setTemplates(tempData.data || []);
      setTelegram(await teleRes.json());
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

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
      if (statsData.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(statsData[0].campaignId);
      }
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

  const fetchBatches = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dashboard/import/batches');
      setBatches(await res.json());
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    }
  };

  const fetchBatchDetails = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dashboard/import/batches/${id}`);
      setSelectedBatch(await res.json());
    } catch (error) {
      console.error('Failed to fetch batch details:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvContent = event.target?.result as string;
      const name = file.name.replace('.csv', '');
      setIsImporting(true);
      try {
        await fetch('http://localhost:3000/api/dashboard/import/csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: selectedCampaignId, name, csvContent })
        });
        fetchBatches();
      } catch (error) {
        console.error('Import failed:', error);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const runAction = async (batchId: string, action: string) => {
    try {
      await fetch(`http://localhost:3000/api/dashboard/import/batches/${batchId}/${action}`, { method: 'POST' });
      fetchBatchDetails(batchId);
    } catch (error) {
      console.error(`Action ${action} failed:`, error);
    }
  };

  const executeBatch = async (batchId: string) => {
    try {
      await fetch(`http://localhost:3000/api/dashboard/import/batches/${batchId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: null })
      });
      fetchBatches();
      setSelectedBatch(null);
      fetchData();
    } catch (error) {
      console.error('Execution failed:', error);
    }
  };

  const fetchMessages = async (leadId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dashboard/leads/${leadId}/messages`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const toggleAI = async (leadId: string, enabled: boolean) => {
    try {
      await fetch(`http://localhost:3000/api/dashboard/leads/${leadId}/ai-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiEnabled: enabled })
      });
      fetchData();
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, aiEnabled: enabled });
      }
    } catch (error) {
      console.error('Failed to toggle AI:', error);
    }
  };

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

  const saveBusiness = async () => {
    try {
      await fetch('http://localhost:3000/api/dashboard/config/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(business)
      });
      alert('Business profile updated');
    } catch (error) {
      console.error('Failed to save business:', error);
    }
  };

  const saveTelegram = async () => {
    try {
      await fetch('http://localhost:3000/api/dashboard/config/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegram)
      });
      alert('Telegram settings updated');
    } catch (error) {
      console.error('Failed to save telegram:', error);
    }
  };

  const savePrompt = async (role: string, basePrompt: string) => {
    try {
      await fetch('http://localhost:3000/api/dashboard/config/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, basePrompt })
      });
      alert(`${role} prompt updated`);
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  };

  const saveSequence = async (id: string, name: string, waitHours: number) => {
    try {
      await fetch(`http://localhost:3000/api/dashboard/config/sequences/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, waitHours })
      });
      fetchConfig();
      alert('Sequence updated');
    } catch (error) {
      console.error('Failed to save sequence:', error);
    }
  };

  const resolveHandover = async (id: string) => {
    try {
      await fetch(`http://localhost:3000/api/dashboard/leads/${id}/resolve`, { method: 'POST' });
      fetchData();
    } catch (error) {
      console.error('Failed to resolve handover:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchConfig();
    const eventSource = new EventSource('http://localhost:3000/api/dashboard/events');
    eventSource.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      if (selectedLead && data.leadId === selectedLead.id) {
        fetchMessages(selectedLead.id);
      }
      fetchData();
    });
    eventSource.addEventListener('status', () => fetchData());
    eventSource.addEventListener('handover', () => fetchData());
    return () => eventSource.close();
  }, [selectedLead]);

  useEffect(() => {
    if (activeTab === 'import') {
      fetchBatches();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead.id);
    }
  }, [selectedLead]);

  const totalMetrics = stats.reduce((acc, curr) => ({
    totalContacts: acc.totalContacts + curr.metrics.totalContacts,
    interested: acc.interested + curr.metrics.interested,
    conversions: acc.conversions + curr.metrics.conversions,
    blocked: acc.blocked + curr.metrics.blocked,
  }), { totalContacts: 0, interested: 0, conversions: 0, blocked: 0 });

  return (
    <div className="dashboard-container">
      <header>
        <div>
          <h1 className="logo">whatsnaŭ</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Campaign Orchestration Dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <nav className="tabs">
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
            <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>AI Agents</button>
            <button className={activeTab === 'campaign' ? 'active' : ''} onClick={() => setActiveTab('campaign')}>Campaign</button>
            <button className={activeTab === 'templates' ? 'active' : ''} onClick={() => setActiveTab('templates')}>Templates</button>
            <button className={activeTab === 'import' ? 'active' : ''} onClick={() => setActiveTab('import')}>
              <Upload size={14} style={{ marginRight: '6px' }} /> Import
            </button>
          </nav>
          <button className="secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} style={{ marginRight: '8px', verticalAlign: 'middle', animation: loading ? 'spin 2s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </header>

      {activeTab === 'overview' && (
        <>
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
              <div className="search-box">
                <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
                <input type="text" placeholder="Search leads..." style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none' }} />
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
                    <td><span className={`badge badge-${lead.status.toLowerCase()}`}>{lead.status}</span></td>
                    <td><span className={`badge badge-${lead.state.toLowerCase()}`}>{lead.currentStage?.name || lead.state.replace('_', ' ')}</span></td>
                    <td>{lead.tags.map(tag => <span key={tag.name} className="tag">{tag.name}</span>)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{new Date(lead.lastInteraction).toLocaleTimeString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="secondary" title="View Chat" onClick={() => setSelectedLead(lead)}><MessageSquare size={14} /></button>
                        {lead.status === 'HANDOVER' && <button onClick={() => resolveHandover(lead.id)}>Resolve</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="settings-section">
              <h3>Agent Prompts</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Configure the personality and primary objective of each AI agent.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {['CLOSER', 'RECEPTIONIST'].map(role => {
                  const p = prompts.find(pr => pr.role === role) || { basePrompt: '' };
                  return (
                    <div key={role}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4 style={{ color: 'var(--primary)' }}>{role}</h4>
                        <button className="secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => savePrompt(role, p.basePrompt)}>Update</button>
                      </div>
                      <textarea
                        value={p.basePrompt}
                        onChange={(e) => setPrompts(prompts.map(pr => pr.role === role ? { ...pr, basePrompt: e.target.value } : pr))}
                        placeholder={`System prompt for ${role}...`}
                        rows={6}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', color: '#fff', padding: '1rem', fontFamily: 'monospace' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="settings-section">
              <h3>Business Knowledge Base</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>This information is injected into all agents to ensure accurate responses.</p>
              <textarea
                value={business.knowledgeBase || ''}
                onChange={(e) => setBusiness({ ...business, knowledgeBase: e.target.value })}
                placeholder="Describe your business..."
                rows={12}
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', color: '#fff', padding: '1rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button onClick={saveBusiness}>Save Knowledge Base</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Clock size={20} color="var(--accent)" />
                <h3 style={{ margin: 0 }}>Availability</h3>
              </div>
              <div className="keyword-form" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                <input type="text" placeholder="e.g. 'en una reunión'..." value={availability} onChange={(e) => setAvailability(e.target.value)} />
                <button onClick={updateAvailability} disabled={isSavingStatus}>{isSavingStatus ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <ShieldAlert size={20} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>Handover</h3>
              </div>
              <form onSubmit={addKeyword} className="keyword-form" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                <select value={kwType} onChange={(e) => setKwType(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: '#fff', borderRadius: '0.75rem', padding: '0.5rem' }}>
                  <option value="INTERNAL">Owner Trigger</option>
                  <option value="LEAD">Lead Request</option>
                </select>
                <input type="text" placeholder="Phrase..." value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} />
                <button type="submit">Add</button>
              </form>
              <div className="keyword-list">
                {keywords.map((k) => (
                  <div key={k.id} className="keyword-pill" style={{ borderColor: k.type === 'INTERNAL' ? 'var(--primary-glow)' : 'var(--accent)' }}>
                    {k.word} <button onClick={() => removeKeyword(k.id)}><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Send size={20} color="#229ED9" />
                <h3 style={{ margin: 0 }}>Telegram Alerts</h3>
              </div>
              <div className="keyword-form" style={{ flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={telegram.isEnabled} onChange={(e) => setTelegram({ ...telegram, isEnabled: e.target.checked })} style={{ width: 'auto' }} />
                  <span style={{ fontSize: '0.875rem' }}>Enable Telegram Notifications</span>
                </div>
                <input type="text" placeholder="Bot Token" value={telegram.botToken} onChange={(e) => setTelegram({ ...telegram, botToken: e.target.value })} style={{ width: '100%' }} />
                <input type="text" placeholder="Chat ID" value={telegram.chatId} onChange={(e) => setTelegram({ ...telegram, chatId: e.target.value })} style={{ width: '100%' }} />
                <button onClick={saveTelegram}>Save Telegram Config</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'campaign' && (
        <div className="settings-section">
          <h3>Campaign Flow (Sequences)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>Define follow-ups.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sequences.map(s => (
              <div key={s.id} className="stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>{s.order}</div>
                  <div>
                    <input type="text" value={s.name} onChange={(e) => setSequences(sequences.map(sq => sq.id === s.id ? { ...sq, name: e.target.value } : sq))} style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 600, fontSize: '1rem', outline: 'none' }} />
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Wait: <input type="number" value={s.waitHours} onChange={(e) => setSequences(sequences.map(sq => sq.id === s.id ? { ...sq, waitHours: Number(e.target.value) } : sq))} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '40px', textAlign: 'center' }} /> hours
                    </div>
                  </div>
                </div>
                <button className="secondary" onClick={() => saveSequence(s.id, s.name, s.waitHours)}>Save</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="settings-section">
          <h3>WhatsApp Marketing Templates</h3>
          <div className="stats-grid">
            {templates.map(t => (
              <div key={t.name} className="stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{t.name}</span>
                  <span className="badge badge-active">{t.status}</span>
                </div>
                <div style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>"{t.components?.find(c => c.type === 'BODY')?.text}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="settings-section">
          {!selectedBatch ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <h3>Mass Outreach (Import)</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Upload CSV to prepare new leads.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: '#fff', borderRadius: '0.5rem', padding: '0.5rem' }}
                  >
                    {stats.map(s => <option key={s.campaignId} value={s.campaignId}>{s.name}</option>)}
                  </select>
                  <div style={{ position: 'relative' }}>
                    <input type="file" accept=".csv" onChange={handleFileUpload} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} disabled={isImporting || !selectedCampaignId} />
                    <button className="secondary" disabled={isImporting || !selectedCampaignId}>{isImporting ? 'Importing...' : 'Upload CSV'}</button>
                  </div>
                </div>
              </div>
              <div className="stats-grid">
                {batches.map(b => (
                  <div key={b.id} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => fetchBatchDetails(b.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>{b.name}</span>
                      <span className="badge badge-active">{b.status}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Leads: {b._count?.stagingLeads || 0} | {new Date(b.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="staging-view">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button className="secondary" onClick={() => setSelectedBatch(null)}>← Back</button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="secondary" onClick={() => runAction(selectedBatch.id, 'cleanse')}>Cleanse</button>
                  <button className="secondary" onClick={() => runAction(selectedBatch.id, 'verify-wa')}>Verify WA</button>
                  <button className="secondary" onClick={() => runAction(selectedBatch.id, 'analyze-ai')}><Zap size={14} /> AI Analysis</button>
                  <button onClick={() => executeBatch(selectedBatch.id)}>🚀 Execute</button>
                </div>
              </div>
              <table>
                <thead>
                  <tr><th>Lead</th><th>WA</th><th>Status</th><th>Opportunities</th></tr>
                </thead>
                <tbody>
                  {selectedBatch.stagingLeads.map((s) => (
                    <tr key={s.id}>
                      <td><div style={{ fontWeight: 600 }}>{s.name || 'Unknown'}</div><div style={{ fontSize: '0.75rem' }}>{s.phoneNumber}</div></td>
                      <td>{s.isVerified ? (s.isValidWhatsApp ? '✅' : '❌') : '⏳'}</td>
                      <td><span className={`badge badge-${s.cleanseStatus.toLowerCase()}`}>{s.cleanseStatus}</span></td>
                      <td>{s.opportunities.map((o) => <span key={o.id} className="tag">{o.type}</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedLead && (
        <div className="modal-overlay">
          <div className="chat-modal">
            <div className="chat-header">
              <div>
                <h3>{selectedLead.name || 'Chat'}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedLead.phoneNumber}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.75rem', borderRadius: '2rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: selectedLead.aiEnabled ? 'var(--primary)' : 'var(--text-muted)' }}>AI {selectedLead.aiEnabled ? 'ENABLED' : 'DISABLED'}</span>
                  <button className={`switch-mini ${selectedLead.aiEnabled ? 'active' : ''}`} onClick={() => toggleAI(selectedLead.id, !selectedLead.aiEnabled)}><div className="thumb"></div></button>
                </div>
                <button className="secondary" onClick={() => setSelectedLead(null)}><X size={18} /></button>
              </div>
            </div>
            <div className="chat-messages">
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.direction.toLowerCase()}`}>
                  <div className="message-content">
                    {m.content}
                    <div className="message-meta">{new Date(m.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="chat-input">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." disabled={isSendingMsg} />
              <button type="submit" disabled={isSendingMsg || !newMessage.trim()}>{isSendingMsg ? '...' : 'Send'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
