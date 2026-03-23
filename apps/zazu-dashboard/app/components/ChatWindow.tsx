'use client';

import { useRef, useEffect, useState, FormEvent } from 'react';
import { Send, MessageSquare, CheckCircle2, Settings } from 'lucide-react';

interface ChatWindowProps {
  user: any | null;
  messages: any[];
  onSendMessage: (content: string) => Promise<void>;
  sending: boolean;
}

export default function ChatWindow({ 
  user, 
  messages, 
  onSendMessage, 
  sending 
}: ChatWindowProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || sending) return;

    await onSendMessage(inputText);
    setInputText('');
  };

  if (!user) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', gap: '20px' }}>
        <MessageSquare size={80} style={{ opacity: 0.1 }} />
        <p>Selecciona un chat para iniciar la gestión táctica.</p>
      </div>
    );
  }

  return (
    <div className="chat-area">
      <div style={{ padding: '20px 40px', borderBottom: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="user-avatar">
            {user.displayName?.[0] || user.firstName?.[0]}
          </div>
          <div>
            <h3 style={{ fontWeight: 800 }}>{user.displayName || user.firstName}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={12} /> ONLINE VIA TELEGRAM
            </span>
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
          <Settings size={20} />
        </button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {messages.map((msg: any) => (
          <div key={msg.id} className={`message-bubble ${msg.role === 'USER' ? 'message-user' : 'message-assistant'}`}>
            <div className="glass-card message-content">
              <p>{msg.content}</p>
            </div>
            <span className="message-timestamp" style={{ textAlign: msg.role === 'USER' ? 'left' : 'right' }}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-dim)', opacity: 0.5, fontSize: '0.9rem' }}>
            No hay mensajes previos en esta conversación
          </div>
        )}
      </div>

      <form onSubmit={handleSend} style={{ padding: '30px 40px', borderTop: '1px solid var(--border-glass)' }}>
        <div style={{ position: 'relative' }}>
          <input 
            className="input-field" 
            placeholder="Enviar mensaje como Zazŭ..." 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending}
            style={{ borderRadius: '24px', paddingRight: '100px', paddingLeft: '24px', height: '54px' }} 
          />
          <button 
            type="submit"
            disabled={sending}
            className="btn-primary" 
            style={{ position: 'absolute', right: '6px', top: '6px', height: '42px', borderRadius: '21px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Send size={16} /> <span>{sending ? '...' : 'ENVIAR'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
