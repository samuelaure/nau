import React from 'react';
import type { SequenceConfig } from '../../types';

interface CampaignFlowProps {
    sequences: SequenceConfig[];
    onSave: (id: string, name: string, waitHours: number) => void;
    onUpdateSequences: (sequences: SequenceConfig[]) => void;
}

export const CampaignFlow: React.FC<CampaignFlowProps> = ({
    sequences,
    onSave,
    onUpdateSequences,
}) => {
    return (
        <div className="settings-section">
            <h3>Campaign Flow (Sequences)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
                Define follow-ups.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sequences.map((s) => (
                    <div
                        key={s.id}
                        className="stat-card"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                            <div
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    background: 'var(--primary)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    fontWeight: 'bold',
                                }}
                            >
                                {s.order}
                            </div>
                            <div>
                                <input
                                    type="text"
                                    value={s.name}
                                    onChange={(e) =>
                                        onUpdateSequences(
                                            sequences.map((sq) => (sq.id === s.id ? { ...sq, name: e.target.value } : sq))
                                        )
                                    }
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#fff',
                                        fontWeight: 600,
                                        fontSize: '1rem',
                                        outline: 'none',
                                    }}
                                />
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        alignItems: 'center',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        marginTop: '0.25rem',
                                    }}
                                >
                                    Wait:{' '}
                                    <input
                                        type="number"
                                        value={s.waitHours}
                                        onChange={(e) =>
                                            onUpdateSequences(
                                                sequences.map((sq) =>
                                                    sq.id === s.id ? { ...sq, waitHours: Number(e.target.value) } : sq
                                                )
                                            )
                                        }
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: 'none',
                                            color: '#fff',
                                            width: '40px',
                                            textAlign: 'center',
                                        }}
                                    />{' '}
                                    hours
                                </div>
                            </div>
                        </div>
                        <button className="secondary" onClick={() => onSave(s.id, s.name, s.waitHours)}>
                            Save
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
