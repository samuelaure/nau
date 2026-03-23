/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { getUsers, getChatHistory, sendMessageAsZazu, toggleUserFeature } from './lib/actions';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsPanel from './components/SettingsPanel';
import { UserWithFeatures, Message } from './lib/types';

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const [users, setUsers] = useState<UserWithFeatures[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const selectedUser = users.find(u => u.id === selectedUserId);

  useEffect(() => {
    loadUsers();
    const interval = setInterval(loadUsers, 5000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadChatHistory(selectedUserId);
      const interval = setInterval(() => loadChatHistory(selectedUserId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUserId]);

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
      // Remove optimistic message if failed
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
        user={selectedUser || null}
        messages={messages}
        onSendMessage={handleSendMessage}
        sending={sending}
        onToggleSettings={onToggleSettings}
      />

      {settingsOpen && selectedUser && (
        <SettingsPanel 
          user={selectedUser}
          onToggleFeature={handleToggleFeature}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
