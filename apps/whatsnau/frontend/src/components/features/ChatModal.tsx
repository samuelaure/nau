import React from 'react';
import { X } from 'lucide-react';
import type { Lead, Message } from '../../types';

interface ChatModalProps {
    lead: Lead;
    messages: Message[];
    newMessage: string;
    isSending: boolean;
    onSetNewMessage: (msg: string) => void;
    onSendMessage: (e: React.FormEvent) => void;
    onToggleAI: (enabled: boolean) => void;
    onClose: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
    lead,
    messages,
    newMessage,
    isSending,
    onSetNewMessage,
    onSendMessage,
    onToggleAI,
    onClose,
}) => {
    return (
        <div className="modal-overlay">
            <div className="chat-modal">
                <div className="chat-header">
                    <div>
                        <h3>{lead.name || 'Chat'}</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.phoneNumber}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'rgba(255,255,255,0.05)',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '2rem',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: lead.aiEnabled ? 'var(--primary)' : 'var(--text-muted)',
                                }}
                            >
                                AI {lead.aiEnabled ? 'ENABLED' : 'DISABLED'}
                            </span>
                            <button
                                className={`switch-mini ${lead.aiEnabled ? 'active' : ''}`}
                                onClick={() => onToggleAI(!lead.aiEnabled)}
                            >
                                <div className="thumb"></div>
                            </button>
                        </div>
                        <button className="secondary" onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>
                </div>
                <div className="chat-messages">
                    {messages.map((m) => (
                        <div key={m.id} className={`message ${m.direction.toLowerCase()}`}>
                            <div className="message-content">
                                {m.content}
                                <div className="message-meta">{new Date(m.timestamp).toLocaleTimeString()}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <form onSubmit={onSendMessage} className="chat-input">
                    <input
                        value={newMessage}
                        onChange={(e) => onSetNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        disabled={isSending}
                    />
                    <button type="submit" disabled={isSending || !newMessage.trim()}>
                        {isSending ? '...' : 'Send'}
                    </button>
                </form>
            </div>
        </div>
    );
};
