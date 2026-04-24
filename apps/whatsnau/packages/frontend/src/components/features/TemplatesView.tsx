import React, { useState, useEffect } from 'react';
import type { Template, SequenceConfig } from '../../types';
import { Badge } from '../ui/Badge';

interface TemplatesViewProps {
  initialTemplates: Template[];
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ initialTemplates }) => {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [stages, setStages] = useState<SequenceConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingTemplate, setLinkingTemplate] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [mapping, setMapping] = useState<string>('{"1": "name", "2": "business"}');

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      const res = await fetch('/api/config/sequences');
      const data = await res.json();
      setStages(data);
    } catch (error) {
      console.error('Failed to fetch stages:', error);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      await fetch('/api/config/whatsapp-templates/sync', { method: 'POST' });
      const res = await fetch('/api/config/whatsapp-templates');
      const data = await res.json();
      setTemplates(data.data || []);
      alert('Templates synced successfully!');
    } catch (error) {
      console.error('Failed to sync:', error);
      alert('Failed to sync templates.');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (templateName: string) => {
    if (!selectedStage) return alert('Please select a stage');

    try {
      let variableMapping = null;
      try {
        variableMapping = JSON.parse(mapping);
      } catch {
        return alert('Invalid JSON mapping');
      }

      const res = await fetch('/api/config/whatsapp-templates/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaTemplateName: templateName,
          messageTemplateId: selectedStage,
          variableMapping,
        }),
      });

      if (res.ok) {
        alert(`Linked ${templateName} to stage!`);
        setLinkingTemplate(null);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (error) {
      console.error('Failed to link:', error);
    }
  };

  return (
    <div className="settings-section">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3>WhatsApp Marketing Templates</h3>
        <button onClick={handleSync} disabled={loading} className="secondary">
          {loading ? 'Syncing...' : '🔄 Sync from Meta'}
        </button>
      </div>

      <div className="stats-grid">
        {templates.map((t) => (
          <div key={t.name} className="stat-card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{t.name}</span>
              <Badge variant={t.status}>{t.status}</Badge>
            </div>

            <div
              style={{
                fontSize: '0.875rem',
                fontStyle: 'italic',
                marginBottom: '1rem',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              "{t.components?.find((c) => c.type === 'BODY')?.text}"
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
              {linkingTemplate === t.name ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                    }}
                  >
                    <option value="">Link to Campaign Stage...</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (order {s.order})
                      </option>
                    ))}
                  </select>
                  <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                    Variable Mapping (JSON):
                  </label>
                  <input
                    type="text"
                    value={mapping}
                    onChange={(e) => setMapping(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleLink(t.name)}
                      style={{ flex: 1, padding: '0.4rem' }}
                    >
                      Link Now
                    </button>
                    <button
                      onClick={() => setLinkingTemplate(null)}
                      className="secondary"
                      style={{ flex: 1, padding: '0.4rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setLinkingTemplate(t.name)}
                  className="secondary"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                >
                  🔗 Link to Campaign Stage
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
