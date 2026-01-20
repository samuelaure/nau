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
}) => {
    return (
        <div className="settings-section">
            {!selectedBatch ? (
                <>
                    <FeatureHeader
                        title="Mass Outreach (Import)"
                        description="Upload CSV to prepare new leads."
                        actions={
                            <>
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
                                    {stats.map((s) => (
                                        <option key={s.campaignId} value={s.campaignId}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
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
