'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { getUsers, getChatHistory, sendMessageAsZazu, toggleUserFeature } from './lib/actions';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsPanel from './components/SettingsPanel';

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const selectedUser = users.find(u => u.id === selectedUserId);

  useEffect(() => {
    loadUsers();
    const interval = setInterval(loadUsers, 5000); // Polling for new chats/messages
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadChatHistory(selectedUserId);
    }
  }, [selectedUserId]);

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data as any[]);
    setLoading(false);
  };

  const loadChatHistory = async (userId: string) => {
    const data = await getChatHistory(userId);
    setMessages(data as any[]);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedUser) return;
    setSending(true);
    const result = await sendMessageAsZazu(selectedUser.id, selectedUser.telegramId, content);
    if (result.success) {
      await loadChatHistory(selectedUser.id);
    } else {
      alert(`Error enviando: ${result.error}`);
    }
    setSending(false);
  };

  const handleToggleFeature = async (featureId: string) => {
    if (!selectedUser) return;
    const isCurrentlyActive = (selectedUser.features as string[])?.includes(featureId);
    
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
      // Revert if failed
      loadUsers();
      alert('Error actualizando módulos');
    }
  };

  const onToggleSettings = () => {
    setSettingsOpen(!settingsOpen);
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Zap className="glow-text" size={48} style={{ animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  return (
    <div className={`dashboard-grid ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${!settingsOpen ? 'settings-collapsed' : ''}`}>
      <Sidebar 
        users={users}
        selectedUserId={selectedUserId}
        onSelectUser={setSelectedUserId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onToggleSettings={onToggleSettings}
      />

      <ChatWindow 
        user={selectedUser}
        messages={messages}
        onSendMessage={handleSendMessage}
        sending={sending}
        onToggleSettings={onToggleSettings}
      />

      {settingsOpen && (
        <SettingsPanel 
          user={selectedUser}
          onToggleFeature={handleToggleFeature}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
