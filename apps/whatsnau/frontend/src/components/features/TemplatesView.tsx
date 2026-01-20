import React from 'react';
import type { Template } from '../../types';
import { Badge } from '../ui/Badge';

interface TemplatesViewProps {
  templates: Template[];
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ templates }) => {
  return (
    <div className="settings-section">
      <h3>WhatsApp Marketing Templates</h3>
      <div className="stats-grid">
        {templates.map((t) => (
          <div key={t.name} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{t.name}</span>
              <Badge variant={t.status}>{t.status}</Badge>
            </div>
            <div style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
              "{t.components?.find((c) => c.type === 'BODY')?.text}"
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
