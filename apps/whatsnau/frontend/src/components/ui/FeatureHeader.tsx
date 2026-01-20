import React from 'react';

interface FeatureHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const FeatureHeader: React.FC<FeatureHeaderProps> = ({ title, description, actions }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
    }}
  >
    <div>
      <h3>{title}</h3>
      {description && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{description}</p>
      )}
    </div>
    {actions && <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>{actions}</div>}
  </div>
);
