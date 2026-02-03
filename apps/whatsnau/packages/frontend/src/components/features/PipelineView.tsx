import React from 'react';
import type { Lead } from '../../types';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { Clock, User } from 'lucide-react';

interface PipelineViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

const STAGES = [
  { id: 'COLD', label: 'Cold / New', color: '#94a3b8' },
  { id: 'INTERESTED', label: 'Interested', color: 'var(--accent)' },
  { id: 'DEMO', label: 'In Demo', color: 'var(--primary)' },
  { id: 'NURTURING', label: 'Nurturing', color: '#f59e0b' },
  { id: 'CLIENTS', label: 'Converted', color: 'var(--success)' },
];

export const PipelineView: React.FC<PipelineViewProps> = ({ leads, onSelectLead }) => {
  const getLeadsInStage = (stageId: string) => {
    return leads.filter((l) => l.state === stageId);
  };

  return (
    <div className="pipeline-board">
      {STAGES.map((stage) => {
        const stageLeads = getLeadsInStage(stage.id);
        return (
          <div key={stage.id} className="pipeline-column">
            <div className="pipeline-column-header">
              <div className="stage-indicator" style={{ backgroundColor: stage.color }}></div>
              <h3>{stage.label}</h3>
              <span className="lead-count">{stageLeads.length}</span>
            </div>
            <div className="pipeline-cards">
              {stageLeads.map((lead) => (
                <div key={lead.id} className="pipeline-card" onClick={() => onSelectLead(lead)}>
                  <div className="card-header">
                    <User size={14} className="text-muted" />
                    <span className="lead-name">{lead.name || 'Unknown'}</span>
                  </div>
                  <div className="lead-phone">{lead.phoneNumber}</div>

                  <div className="card-tags">
                    {lead.tags.slice(0, 3).map((tag) => (
                      <Tag key={tag.name}>{tag.name}</Tag>
                    ))}
                  </div>

                  <div className="card-footer">
                    <div className="card-meta">
                      <Clock size={12} />
                      <span>{new Date(lead.lastInteraction).toLocaleDateString()}</span>
                    </div>
                    {lead.status === 'HANDOVER' && <Badge variant="HANDOVER">Handover</Badge>}
                  </div>
                </div>
              ))}
              {stageLeads.length === 0 && <div className="empty-stage">No leads in this stage</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
