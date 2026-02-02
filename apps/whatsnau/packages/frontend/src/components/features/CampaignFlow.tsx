import React from 'react';
import type { SequenceConfig } from '../../types';
import { WorkflowBuilder } from './workflow/WorkflowBuilder';

interface CampaignFlowProps {
  sequences: SequenceConfig[];
  onSave: (id: string, name: string, waitHours: number) => void;
  onUpdateSequences: (sequences: SequenceConfig[]) => void;
}

export const CampaignFlow: React.FC<CampaignFlowProps> = () => {
  return (
    <div
      className="settings-section"
      style={{ padding: 0, height: '80vh', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ padding: '1.5rem 1.5rem 0.5rem 1.5rem' }}>
        <h3>Visual Workflow Builder</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Design your message sequencing with a DAG-based logic. Message nodes support content
          definition, Wait nodes handle delay, and Logic nodes support nested Boolean conditions.
        </p>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <WorkflowBuilder />
      </div>
    </div>
  );
};
