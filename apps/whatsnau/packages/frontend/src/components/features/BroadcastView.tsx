import React, { useState, useEffect } from 'react';
import { FeatureHeader } from '../ui/FeatureHeader';
import { Badge } from '../ui/Badge';

interface Lead {
  id: string;
  name: string | null;
  phoneNumber: string;
  state: string;
}

export const BroadcastView: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('NURTURING');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    }
  };

  const filteredLeads =
    selectedFilter === 'ALL' ? leads : leads.filter((l) => l.state === selectedFilter);

  const handleSendBroadcast = async () => {
    if (!message.trim()) return alert('Please enter a message');
    if (filteredLeads.length === 0) return alert('No leads in this segment');

    if (!confirm(`Are you sure you want to send this broadcast to ${filteredLeads.length} leads?`))
      return;

    setSending(true);
    setProgress({ current: 0, total: filteredLeads.length });

    for (let i = 0; i < filteredLeads.length; i++) {
      const lead = filteredLeads[i];
      try {
        await fetch(`/api/leads/${lead.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: message }),
        });
        setProgress((p) => ({ ...p, current: i + 1 }));
      } catch (error) {
        console.error(`Failed to send to ${lead.phoneNumber}:`, error);
      }
      // Small delay to avoid API rate limits
      await new Promise((r) => setTimeout(r, 200));
    }

    setSending(false);
    setMessage('');
    alert('Broadcast completed!');
  };

  return (
    <div className="feature-container">
      <FeatureHeader
        title="Broadcast System"
        description="Send bulk messages to specific lead segments (Nurturing, Interested, etc.)"
      />

      <div className="stats-grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Configuration Panel */}
        <div
          className="glass-card"
          style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}
        >
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Broadcast Settings</h3>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Target Segment:
            </label>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            >
              <option value="NURTURING">
                Nurturing Leads ({leads.filter((l) => l.state === 'NURTURING').length})
              </option>
              <option value="INTERESTED">
                Interested Leads ({leads.filter((l) => l.state === 'INTERESTED').length})
              </option>
              <option value="CLIENTS">
                Clients ({leads.filter((l) => l.state === 'CLIENTS').length})
              </option>
              <option value="ALL">All Contacts ({leads.length})</option>
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Message Content:
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here... Use {{name}} for personalization."
              rows={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                resize: 'none',
              }}
            />
          </div>

          {sending && (
            <div style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  marginBottom: '0.4rem',
                }}
              >
                <span>Progress</span>
                <span>
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                    height: '100%',
                    background: 'var(--primary)',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleSendBroadcast}
            disabled={sending || !message.trim()}
            style={{
              width: '100%',
              padding: '1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {sending ? '🚀 Sending Broadcast...' : `Send to ${filteredLeads.length} Leads`}
          </button>
        </div>

        {/* Lead List Preview */}
        <div
          className="glass-card"
          style={{
            padding: '1.5rem',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Target List Preview</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.5)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <th style={{ padding: '0.5rem' }}>Name</th>
                  <th style={{ padding: '0.5rem' }}>Phone</th>
                  <th style={{ padding: '0.5rem' }}>State</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <td style={{ padding: '0.5rem' }}>{lead.name || 'Unknown'}</td>
                    <td style={{ padding: '0.5rem' }}>{lead.phoneNumber}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <Badge variant={lead.state}>{lead.state}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
