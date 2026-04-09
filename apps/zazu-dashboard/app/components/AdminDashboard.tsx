import { useState, useEffect } from 'react';
import { Zap, Broadcast } from 'lucide-react';
import { getUsers, getChatHistory, sendMessageAsZazu, toggleUserFeature, sendBroadcast } from '../lib/actions';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import SettingsPanel from './SettingsPanel';
import { UserWithFeatures, Message } from '../lib/types';

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserWithFeatures[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const selectedUser = users.find(u => u.id === selectedUserId);

  useEffect(() => {
    loadUsers();
    const interval = setInterval(loadUsers, 5000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedUserId && !isBroadcasting) {
      loadChatHistory(selectedUserId);
      const interval = setInterval(() => loadChatHistory(selectedUserId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUserId, isBroadcasting]);

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data as UserWithFeatures[]);
    setLoading(false);
  };

  const loadChatHistory = async (userId: string) => {
    const data = await getChatHistory(userId);
    setMessages(data as unknown as Message[]);
  };

  const handleSendMessage = async (content: string) => {
    if (isBroadcasting) {
      setSending(true);
      const result = await sendBroadcast(content);
      if (result.success) {
        alert('Broadcast enviado a todos los usuarios.');
      } else {
        alert(`Error en Broadcast: ${result.error}`);
      }
      setSending(false);
      return;
    }

    if (!selectedUser) return;
    
    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      userId: selectedUser.id,
      role: 'ASSISTANT',
      content,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, optimisticMessage]);
    
    setSending(true);
    const result = await sendMessageAsZazu(selectedUser.id, selectedUser.telegramId, content);
    
    if (result.success) {
      await loadChatHistory(selectedUser.id);
      await loadUsers();
    } else {
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      alert(`Error enviando: ${result.error}`);
    }
    setSending(false);
  };

  const handleToggleFeature = async (featureId: string) => {
    if (!selectedUser) return;
    const isCurrentlyActive = selectedUser.features?.includes(featureId);
    
    // Optimistic update
    const updatedUsers = users.map(u => {
      if (u.id === selectedUser.id) {
        const newFeatures = isCurrentlyActive 
          ? u.features.filter((f: string) => f !== featureId)
          : [...u.features, featureId];
        return { ...u, features: newFeatures };
      }
      return u;
    });
    setUsers(updatedUsers);

    const result = await toggleUserFeature(selectedUser.id, featureId, !isCurrentlyActive);
    if (!result.success) {
      loadUsers();
      alert('Error actualizando módulos');
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Zap className="glow-text" size={48} style={{ animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  return (
    <div className={`dashboard-grid ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${!settingsOpen ? 'settings-collapsed' : ''}`} style={{ flex: 1 }}>
      <Sidebar 
        users={users}
        selectedUserId={selectedUserId}
        onSelectUser={(id) => {
          setIsBroadcasting(false);
          setSelectedUserId(id);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
      />

      {isBroadcasting ? (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <Broadcast size={24} /> Transmisión Global (Broadcast)
          </h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: '20px' }}>
            Envía un mensaje a todos los usuarios registrados en Zazŭ.
          </p>
          <div style={{ flex: 1, border: '1px solid var(--border-glass)', borderRadius: '12px', background: 'var(--surface)', padding: '20px' }}>
            <textarea 
              placeholder="Escribe el mensaje global aquí..."
              style={{ width: '100%', height: '80%', background: 'transparent', border: '1px solid var(--border-glass)', color: '#fff', padding: '16px', borderRadius: '8px', resize: 'none' }}
              id="broadcastInput"
            />
            <button 
              className="btn-primary" 
              style={{ width: '100%', marginTop: '16px' }}
              disabled={sending}
              onClick={() => {
                const el = document.getElementById('broadcastInput') as HTMLTextAreaElement;
                if (el && el.value) handleSendMessage(el.value);
              }}
            >
              {sending ? 'Enviando...' : 'Transmitir a todos'}
            </button>
          </div>
        </div>
      ) : (
        <ChatWindow 
          user={selectedUser || null}
          messages={messages}
          onSendMessage={handleSendMessage}
          sending={sending}
          onToggleSettings={() => setSettingsOpen(!settingsOpen)}
        />
      )}

      {settingsOpen && selectedUser && !isBroadcasting && (
        <SettingsPanel 
          user={selectedUser}
          onToggleFeature={handleToggleFeature}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
