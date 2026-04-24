import React, { useState } from 'react';
import { Clock, Shield, Send, X } from 'lucide-react';
import { WhatsAppOnboarding } from './WhatsAppOnboarding';
import { OpenAISettings } from './OpenAISettings';
import type { BusinessConfig, PromptConfig, TelegramConfig, KeywordConfig } from '../../types';
import { Tag } from '../ui/Tag';

interface AIAgentsProps {
  business: BusinessConfig;
  prompts: PromptConfig[];
  telegram: TelegramConfig;
  keywords: KeywordConfig[];
  availability: string;
  onSaveBusiness: (data: BusinessConfig) => void;
  onSavePrompt: (role: string, prompt: string) => void;
  onSaveTelegram: (data: TelegramConfig) => void;
  onUpdateAvailability: (status: string) => void;
  onAddKeyword: (word: string, type: string) => void;
  onRemoveKeyword: (id: string) => void;
  metaAppId?: string;
}

interface AgentPromptEditorProps {
  role: string;
  prompt: PromptConfig | undefined;
  onSave: (role: string, prompt: string) => void;
}

const AgentPromptEditor: React.FC<AgentPromptEditorProps> = ({ role, prompt, onSave }) => {
  const [localPrompt, setLocalPrompt] = React.useState(prompt?.basePrompt || '');

  React.useEffect(() => {
    setLocalPrompt(prompt?.basePrompt || '');
  }, [prompt?.basePrompt]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <h4 style={{ color: 'var(--primary)' }}>{role}</h4>
        <button
          className="secondary"
          style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
          onClick={() => onSave(role, localPrompt)}
          disabled={localPrompt === prompt?.basePrompt}
        >
          Update
        </button>
      </div>
      <textarea
        value={localPrompt}
        onChange={(e) => setLocalPrompt(e.target.value)}
        onBlur={() => {
          if (localPrompt !== prompt?.basePrompt) {
            onSave(role, localPrompt);
          }
        }}
        placeholder={`System prompt for ${role}...`}
        rows={6}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--card-border)',
          borderRadius: '0.75rem',
          color: '#fff',
          padding: '1rem',
          fontFamily: 'monospace',
        }}
      />
    </div>
  );
};

export const AIAgents: React.FC<AIAgentsProps> = ({
  business,
  prompts,
  telegram,
  keywords,
  availability,
  onSaveBusiness,
  onSavePrompt,
  onSaveTelegram,
  onUpdateAvailability,
  onAddKeyword,
  onRemoveKeyword,
  metaAppId,
}) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [kwType, setKwType] = useState('INTERNAL');
  const [localAvailability, setLocalAvailability] = useState(availability);
  const [localBusiness, setLocalBusiness] = useState(business);
  const [localTelegram, setLocalTelegram] = useState(telegram);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="settings-section">
          <h3>Agent Prompts</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Configure the personality and primary objective of each AI agent.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {['CLOSER', 'RECEPTIONIST', 'NURTURING'].map((role) => (
              <AgentPromptEditor
                key={role}
                role={role}
                prompt={prompts.find((p) => p.role === role)}
                onSave={onSavePrompt}
              />
            ))}
          </div>
        </div>
        <div className="settings-section">
          <h3>Business Knowledge Base</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            This information is injected into all agents to ensure accurate responses.
          </p>
          <textarea
            value={localBusiness.knowledgeBase}
            onChange={(e) => setLocalBusiness({ ...localBusiness, knowledgeBase: e.target.value })}
            placeholder="Describe your business..."
            rows={12}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--card-border)',
              borderRadius: '0.75rem',
              color: '#fff',
              padding: '1rem',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button onClick={() => onSaveBusiness(localBusiness)}>Save Knowledge Base</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <WhatsAppOnboarding appId={metaAppId} />
        <OpenAISettings />
        <div className="settings-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Clock size={20} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Availability</h3>
          </div>
          <div className="keyword-form" style={{ flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="e.g. 'en una reunión'..."
              value={localAvailability}
              onChange={(e) => setLocalAvailability(e.target.value)}
            />
            <button onClick={() => onUpdateAvailability(localAvailability)}>Save</button>
          </div>
        </div>
        <div className="settings-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Shield size={20} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Handover</h3>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAddKeyword(newKeyword, kwType);
              setNewKeyword('');
            }}
            className="keyword-form"
            style={{ flexDirection: 'column', gap: '0.5rem' }}
          >
            <select
              value={kwType}
              onChange={(e) => setKwType(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--card-border)',
                color: '#fff',
                borderRadius: '0.75rem',
                padding: '0.5rem',
              }}
            >
              <option value="INTERNAL">Owner Trigger</option>
              <option value="LEAD">Lead Request</option>
            </select>
            <input
              type="text"
              placeholder="Phrase..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>
          <div className="keyword-list">
            {keywords.map((k) => (
              <Tag
                key={k.id}
                color={k.type === 'INTERNAL' ? 'var(--primary-glow)' : 'var(--accent)'}
              >
                {k.word}{' '}
                <button
                  onClick={() => onRemoveKeyword(k.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </Tag>
            ))}
          </div>
        </div>
        <div className="settings-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Send size={20} color="#229ED9" />
            <h3 style={{ margin: 0 }}>Telegram Alerts</h3>
          </div>
          <div className="keyword-form" style={{ flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={localTelegram.isEnabled}
                onChange={(e) =>
                  setLocalTelegram({ ...localTelegram, isEnabled: e.target.checked })
                }
                style={{ width: 'auto' }}
              />
              <span style={{ fontSize: '0.875rem' }}>Enable Telegram Notifications</span>
            </div>
            <input
              type="text"
              placeholder="Bot Token"
              value={localTelegram.botToken}
              onChange={(e) => setLocalTelegram({ ...localTelegram, botToken: e.target.value })}
              style={{ width: '100%' }}
            />
            <input
              type="text"
              placeholder="Chat ID"
              value={localTelegram.chatId}
              onChange={(e) => setLocalTelegram({ ...localTelegram, chatId: e.target.value })}
              style={{ width: '100%' }}
            />
            <button onClick={() => onSaveTelegram(localTelegram)}>Save Telegram Config</button>
          </div>
        </div>
      </div>
    </div>
  );
};
