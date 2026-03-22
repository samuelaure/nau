'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { 
  Users, 
  Settings, 
  MessageSquare, 
  Send, 
  LogOut, 
  Plus, 
  User as UserIcon, 
  Search,
  CheckCircle2,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getUsers, getChatHistory, sendMessageAsZazu, toggleUserFeature } from './lib/actions';

export default function Dashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const selectedUser = users.find(u => u.id === selectedUserId);

  useEffect(() => {
    loadUsers();
    const interval = setInterval(loadUsers, 5000); // Poll for new messages every 5s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadChatHistory(selectedUserId);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data);
    setLoading(false);
  };

  const loadChatHistory = async (userId: string) => {
    const data = await getChatHistory(userId);
    setMessages(data);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser || sending) return;

    setSending(true);
    const result = await sendMessageAsZazu(selectedUser.id, selectedUser.telegramId, inputText);
    
    if (result.success) {
      setInputText('');
      loadChatHistory(selectedUser.id);
    } else {
      alert(`Error enviando: ${result.error}`);
    }
    setSending(false);
  };

  const handleToggleFeature = async (feature: string) => {
    if (!selectedUser) return;
    
    const currentFeatures = (selectedUser.features as string[]) || [];
    const newFeatures = currentFeatures.includes(feature)
      ? currentFeatures.filter(f => f !== feature)
      : [...currentFeatures, feature];
    
    const result = await toggleUserFeature(selectedUser.id, newFeatures);
    if (result.success) {
      loadUsers();
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Zap className="glow-text" size={48} style={{ animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', height: '100vh', overflow: 'hidden' }}>
      
      {/* 1. SIDEBAR: Users List */}
      <div className="glass-card" style={{ borderLeft: 'none', borderTop: 'none', borderBottom: 'none', borderRadius: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 className="glow-text" style={{ fontSize: '1.2rem', fontWeight: 800 }}>CHATS ACTIVOS</h2>
            <button onClick={() => signOut()} style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <LogOut size={18} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <input className="input-field" placeholder="Buscar usuario..." style={{ paddingLeft: '36px', fontSize: '0.85rem' }} />
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {users.map(user => (
            <div 
              key={user.id}
              onClick={() => setSelectedUserId(user.id)}
              style={{
                padding: '16px 24px',
                cursor: 'pointer',
                borderLeft: selectedUserId === user.id ? '4px solid var(--primary)' : '4px solid transparent',
                background: selectedUserId === user.id ? 'rgba(0, 255, 136, 0.05)' : 'transparent',
                transition: 'all 0.2s',
                borderBottom: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: selectedUserId === user.id ? 'var(--primary)' : 'white' }}>
                  {user.displayName || user.firstName}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  {user.messages?.[0] && formatDistanceToNow(new Date(user.messages[0].createdAt), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.messages?.[0]?.content || 'Sin mensajes'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. MAIN: Chat Window */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {selectedUser ? (
          <>
            <div style={{ padding: '20px 40px', borderBottom: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black' }}>
                {selectedUser.displayName?.[0] || selectedUser.firstName[0]}
              </div>
              <div>
                <h3 style={{ fontWeight: 800 }}>{selectedUser.displayName || selectedUser.firstName}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> ONLINE VIA TELEGRAM
                </span>
              </div>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{
                  alignSelf: msg.role === 'USER' ? 'flex-start' : 'flex-end',
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div className="glass-card" style={{
                    padding: '12px 18px',
                    background: msg.role === 'USER' ? 'var(--bg-card)' : 'rgba(0, 212, 255, 0.15)',
                    borderColor: msg.role === 'USER' ? 'var(--border-glass)' : 'rgba(0, 212, 255, 0.3)',
                    borderRadius: msg.role === 'USER' ? '0 16px 16px 16px' : '16px 0 16px 16px'
                  }}>
                    <p style={{ fontSize: '0.95rem' }}>{msg.content}</p>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textAlign: msg.role === 'USER' ? 'left' : 'right' }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
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
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', gap: '20px' }}>
            <MessageSquare size={80} style={{ opacity: 0.1 }} />
            <p>Selecciona un chat para iniciar la gestión táctica.</p>
          </div>
        )}
      </div>

      {/* 3. SETTINGS: User Panel */}
      <div className="glass-card" style={{ borderRight: 'none', borderTop: 'none', borderBottom: 'none', borderRadius: 0, padding: '30px' }}>
        {selectedUser ? (
          <div>
            <h2 className="glow-text" style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '30px' }}>DETALLES DEL SUJETO</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <UserIcon size={20} color="var(--primary)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>INFORMACIÓN BASE</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-dim)' }}>Telegram ID:</span> <span>{selectedUser.telegramId}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-dim)' }}>Registro:</span> <span>{new Date(selectedUser.createdAt).toLocaleDateString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-dim)' }}>Estado:</span> <span style={{ color: 'var(--primary)' }}>{selectedUser.onboardingState}</span></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <Zap size={20} color="var(--secondary)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>MÓDULOS ACTIVOS</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { id: 'ai_chat', name: 'Inteligencia Conversacional', icon: <Zap size={14} /> },
                    { id: 'translator', name: 'Traducción Multi-idioma', icon: <Clock size={14} /> },
                    { id: 'scrapper', name: 'Extracción de Datos', icon: <Shield size={14} /> }
                  ].map(feature => (
                    <div 
                      key={feature.id}
                      onClick={() => handleToggleFeature(feature.id)}
                      style={{
                        padding: '12px 16px',
                        background: (selectedUser.features as string[])?.includes(feature.id) ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: (selectedUser.features as string[])?.includes(feature.id) ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {feature.icon}
                        <span style={{ fontSize: '0.8rem' }}>{feature.name}</span>
                      </div>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: '1px solid var(--primary)',
                        background: (selectedUser.features as string[])?.includes(feature.id) ? 'var(--primary)' : 'transparent'
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            <Settings size={60} style={{ opacity: 0.1 }} />
          </div>
        )}
      </div>

    </div>
  );
}
