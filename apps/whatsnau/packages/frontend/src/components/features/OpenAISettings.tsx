import React, { useState, useEffect } from 'react';
import { Brain, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface OpenAIConfig {
    id?: string;
    primaryModel: string;
    cheapModel: string;
    hasApiKey: boolean;
    apiKeyPreview?: string;
}

interface OpenAISettingsProps {
    onConfigUpdate?: () => void;
}

export const OpenAISettings: React.FC<OpenAISettingsProps> = ({ onConfigUpdate }) => {
    const [config, setConfig] = useState<OpenAIConfig | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [primaryModel, setPrimaryModel] = useState('gpt-4o');
    const [cheapModel, setCheapModel] = useState('gpt-4o-mini');
    const [showApiKey, setShowApiKey] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/config/openai');
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
                if (data.primaryModel) setPrimaryModel(data.primaryModel);
                if (data.cheapModel) setCheapModel(data.cheapModel);
            }
        } catch (error) {
            console.error('Failed to fetch OpenAI config:', error);
        }
    };

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setMessage({ type: 'error', text: 'API key is required' });
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            setMessage({ type: 'error', text: 'Invalid API key format. Must start with sk-' });
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            const res = await fetch('/api/config/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, primaryModel, cheapModel }),
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'OpenAI configuration saved successfully' });
                setApiKey('');
                await fetchConfig();
                onConfigUpdate?.();
            } else {
                const _error = await res.json();
                setMessage({ type: 'error', text: _error.message || 'Failed to save configuration' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTest = async () => {
        if (!apiKey.trim()) {
            setMessage({ type: 'error', text: 'Enter an API key to test' });
            return;
        }

        setIsTesting(true);
        setMessage(null);

        try {
            const res = await fetch('/api/config/openai/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey }),
            });

            const result = await res.json();

            if (result.valid) {
                setMessage({ type: 'success', text: '✓ API key is valid' });
            } else {
                setMessage({ type: 'error', text: `Invalid API key: ${result.error}` });
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to test API key' });
        } finally {
            setIsTesting(false);
        }
    };

    const handleDelete = async () => {
        if (!config?.id || !confirm('Are you sure you want to delete this configuration?')) return;

        setIsLoading(true);
        try {
            const res = await fetch(`/api/config/openai/${config.id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Configuration deleted' });
                setConfig(null);
                onConfigUpdate?.();
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to delete configuration' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="settings-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Brain size={20} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>OpenAI Configuration</h3>
            </div>

            {config?.hasApiKey && (
                <div
                    style={{
                        background: 'rgba(76, 175, 80, 0.1)',
                        border: '1px solid rgba(76, 175, 80, 0.3)',
                        borderRadius: '0.75rem',
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        fontSize: '0.875rem',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Check size={16} color="#4CAF50" />
                        <strong>API Key Configured</strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {config.apiKeyPreview}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                        <div>Primary Model: <strong>{config.primaryModel}</strong></div>
                        <div>Cheap Model: <strong>{config.cheapModel}</strong></div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                        API Key
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showApiKey ? 'text' : 'password'}
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            style={{
                                width: '100%',
                                paddingRight: '2.5rem',
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            style={{
                                position: 'absolute',
                                right: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '0.25rem',
                            }}
                        >
                            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                            Primary Model
                        </label>
                        <select
                            value={primaryModel}
                            onChange={(e) => setPrimaryModel(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--card-border)',
                                color: '#fff',
                                borderRadius: '0.75rem',
                                padding: '0.5rem',
                            }}
                        >
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                            Cheap Model
                        </label>
                        <select
                            value={cheapModel}
                            onChange={(e) => setCheapModel(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--card-border)',
                                color: '#fff',
                                borderRadius: '0.75rem',
                                padding: '0.5rem',
                            }}
                        >
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            <option value="gpt-4o">GPT-4o</option>
                        </select>
                    </div>
                </div>

                {message && (
                    <div
                        style={{
                            background: message.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                            border: `1px solid ${message.type === 'success' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'}`,
                            borderRadius: '0.75rem',
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        {message.type === 'success' ? (
                            <Check size={16} color="#4CAF50" />
                        ) : (
                            <AlertCircle size={16} color="#F44336" />
                        )}
                        {message.text}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={handleTest}
                        disabled={isTesting || !apiKey.trim()}
                        className="secondary"
                        style={{ flex: 1 }}
                    >
                        {isTesting ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || !apiKey.trim()}
                        style={{ flex: 1 }}
                    >
                        {isLoading ? 'Saving...' : 'Save'}
                    </button>
                </div>

                {config?.hasApiKey && (
                    <button
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="secondary"
                        style={{
                            background: 'rgba(244, 67, 54, 0.1)',
                            borderColor: 'rgba(244, 67, 54, 0.3)',
                            color: '#F44336',
                        }}
                    >
                        Delete Configuration
                    </button>
                )}
            </div>

            <div
                style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '0.75rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                }}
            >
                <strong>Note:</strong> Your API key is stored securely and never exposed in full. Get your API key from{' '}
                <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                >
                    OpenAI Platform
                </a>
                .
            </div>
        </div>
    );
};
