import React, { useState, useEffect } from 'react';
import { FeatureHeader } from '../ui/FeatureHeader';

interface Campaign {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  stages: CampaignStage[];
}

interface CampaignStage {
  id: string;
  name: string;
  order: number;
  waitHours: number;
  messageTemplates: MessageTemplate[];
}

interface MessageTemplate {
  id: string;
  content: string;
  order: number;
  hasButtons: boolean;
  buttons?: string;
}

export const CampaignManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchCampaigns();
        setIsCreating(false);
        setFormData({ name: '', description: '', isActive: true });
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  };

  const handleToggleActive = async (campaignId: string, isActive: boolean) => {
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      await fetchCampaigns();
    } catch (error) {
      console.error('Failed to toggle campaign:', error);
    }
  };

  return (
    <div className="feature-container">
      <FeatureHeader
        title="Campaign Manager"
        description="Create and manage outreach campaigns with multi-stage sequences"
      />

      <div style={{ marginBottom: '2rem' }}>
        <button
          className="btn-primary"
          onClick={() => setIsCreating(!isCreating)}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          {isCreating ? '✕ Cancel' : '+ New Campaign'}
        </button>
      </div>

      {isCreating && (
        <div
          className="glass-card"
          style={{
            padding: '2rem',
            marginBottom: '2rem',
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Create New Campaign</h3>
          <form onSubmit={handleCreateCampaign}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                Campaign Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Main Outreach Campaign"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose of this campaign..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '1rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ marginRight: '0.5rem' }}
                />
                <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Active</span>
              </label>
            </div>

            <button
              type="submit"
              style={{
                padding: '0.75rem 2rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Create Campaign
            </button>
          </form>
        </div>
      )}

      <div className="stats-grid">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="stat-card"
            style={{
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              border: selectedCampaign?.id === campaign.id ? '2px solid var(--primary)' : 'none',
            }}
            onClick={() => setSelectedCampaign(campaign)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--primary)', fontSize: '1.25rem', fontWeight: 600 }}>
                {campaign.name}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleActive(campaign.id, campaign.isActive);
                }}
                style={{
                  padding: '0.25rem 0.75rem',
                  background: campaign.isActive
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)',
                  border: `1px solid ${campaign.isActive ? '#10b981' : '#ef4444'}`,
                  borderRadius: '12px',
                  color: campaign.isActive ? '#10b981' : '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {campaign.isActive ? '● Active' : '○ Inactive'}
              </button>
            </div>

            <p
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '1rem',
                fontSize: '0.9rem',
              }}
            >
              {campaign.description}
            </p>

            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Stages:</span>{' '}
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  {campaign.stages?.length || 0}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedCampaign && (
        <div
          style={{
            marginTop: '2rem',
            padding: '2rem',
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>
            Campaign Stages: {selectedCampaign.name}
          </h3>

          {selectedCampaign.stages && selectedCampaign.stages.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedCampaign.stages
                .sort((a, b) => a.order - b.order)
                .map((stage, index) => (
                  <div
                    key={stage.id}
                    style={{
                      padding: '1.5rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          marginRight: '1rem',
                        }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <h4 style={{ color: 'white', marginBottom: '0.25rem' }}>{stage.name}</h4>
                        <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                          Wait: {stage.waitHours}h | Templates:{' '}
                          {stage.messageTemplates?.length || 0}
                        </p>
                      </div>
                    </div>

                    {stage.messageTemplates && stage.messageTemplates.length > 0 && (
                      <div style={{ marginTop: '1rem', paddingLeft: '3rem' }}>
                        {stage.messageTemplates.map((template) => (
                          <div
                            key={template.id}
                            style={{
                              padding: '1rem',
                              background: 'rgba(255, 255, 255, 0.02)',
                              borderRadius: '6px',
                              marginBottom: '0.5rem',
                              fontSize: '0.875rem',
                              fontStyle: 'italic',
                              color: 'rgba(255, 255, 255, 0.7)',
                            }}
                          >
                            "{template.content.substring(0, 100)}
                            {template.content.length > 100 ? '...' : ''}"
                            {template.hasButtons && (
                              <span
                                style={{
                                  marginLeft: '0.5rem',
                                  padding: '0.25rem 0.5rem',
                                  background: 'rgba(102, 126, 234, 0.2)',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                }}
                              >
                                🔘 Has Buttons
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', padding: '2rem' }}>
              No stages configured for this campaign yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
