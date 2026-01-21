import React from 'react';
import { Zap } from 'lucide-react';
import type { ImportBatch, CampaignStats } from '../../types';
import { FeatureHeader } from '../ui/FeatureHeader';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';

interface ImportManagerProps {
  batches: ImportBatch[];
  selectedBatch: ImportBatch | null;
  stats: CampaignStats[];
  isImporting: boolean;
  selectedCampaignId: string;
  setSelectedCampaignId: (id: string) => void;
  onSelectBatch: (id: string) => void;
  onBack: () => void;
  onFileUpload: (campaignId: string, file: File) => void;
  onRunAction: (batchId: string, action: string) => void;
  onExecute: (batchId: string) => void;
  onRunReach: (batchId: string) => void;
  onRefresh: () => void;
}

export const ImportManager: React.FC<ImportManagerProps> = ({
  batches,
  selectedBatch,
  stats,
  isImporting,
  selectedCampaignId,
  setSelectedCampaignId,
  onSelectBatch,
  onBack,
  onFileUpload,
  onRunAction,
  onExecute,
  onRunReach,
  onRefresh,
}) => {
  const [showCreateCampaign, setShowCreateCampaign] = React.useState(false);
  const [newCampaignName, setNewCampaignName] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCampaignName,
          description: `Created from import on ${new Date().toLocaleDateString()}`,
          isActive: true,
        }),
      });

      if (res.ok) {
        const campaign = await res.json();
        onRefresh(); // Refresh stats to include new campaign
        setSelectedCampaignId(campaign.id);
        setNewCampaignName('');
        setShowCreateCampaign(false);
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="settings-section">
      {!selectedBatch ? (
        <>
          <FeatureHeader
            title="Mass Outreach (Import)"
            description="Upload CSV to prepare new leads."
            actions={
              <>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--card-border)',
                      color: '#fff',
                      borderRadius: '0.5rem',
                      padding: '0.5rem',
                    }}
                  >
                    <option value="">Select Campaign...</option>
                    {stats.map((s) => (
                      <option key={s.campaignId} value={s.campaignId}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary"
                    onClick={() => setShowCreateCampaign(!showCreateCampaign)}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {showCreateCampaign ? '✕ Cancel' : '+ New Campaign'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onFileUpload(selectedCampaignId, file);
                    }}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer',
                    }}
                    disabled={isImporting || !selectedCampaignId}
                  />
                  <button className="secondary" disabled={isImporting || !selectedCampaignId}>
                    {isImporting ? 'Importing...' : 'Upload CSV'}
                  </button>
                </div>
              </>
            }
          />

          {showCreateCampaign && (
            <div
              style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Create New Campaign</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Campaign name..."
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateCampaign()}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '1rem',
                  }}
                />
                <button
                  onClick={handleCreateCampaign}
                  disabled={!newCampaignName.trim() || isCreating}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          <div className="stats-grid">
            {batches.map((b) => (
              <div
                key={b.id}
                className="stat-card"
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectBatch(b.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{b.name}</span>
                  <Badge variant={b.status}>{b.status}</Badge>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Leads: {b._count?.stagingLeads || 0} |{' '}
                  {new Date(b.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="staging-view">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
            }}
          >
            <button className="secondary" onClick={onBack}>
              ← Back
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="secondary"
                onClick={() => onRunAction(selectedBatch.id, 'cleanse')}
              >
                Cleanse
              </button>
              <button
                className="secondary"
                onClick={() => onRunAction(selectedBatch.id, 'verify-wa')}
              >
                Verify WA
              </button>
              <button
                className="secondary"
                onClick={() => onRunAction(selectedBatch.id, 'analyze-ai')}
              >
                <Zap size={14} /> AI Analysis
              </button>
              {selectedBatch.status !== 'COMPLETED' && (
                <button onClick={() => onExecute(selectedBatch.id)}>🚀 Execute</button>
              )}
              {selectedBatch.status === 'COMPLETED' && (
                <button
                  onClick={() => onRunReach(selectedBatch.id)}
                  style={{ background: 'var(--success)' }}
                >
                  📣 Start Outreach
                </button>
              )}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>WA</th>
                <th>Status</th>
                <th>Opportunities</th>
              </tr>
            </thead>
            <tbody>
              {selectedBatch.stagingLeads.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.name || 'Unknown'}</div>
                    <div style={{ fontSize: '0.75rem' }}>{s.phoneNumber}</div>
                  </td>
                  <td>{s.isVerified ? (s.isValidWhatsApp ? '✅' : '❌') : '⏳'}</td>
                  <td>
                    <Badge variant={s.cleanseStatus}>{s.cleanseStatus}</Badge>
                  </td>
                  <td>
                    {s.opportunities.map((o) => (
                      <Tag key={o.id}>{o.type}</Tag>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
