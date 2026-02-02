import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Overview } from './components/features/Overview';
import { AIAgents } from './components/features/AIAgents';
import { ImportManager } from './components/features/ImportManager';
import { CampaignFlow } from './components/features/CampaignFlow';
import { CampaignManager } from './components/features/CampaignManager';
import { BroadcastView } from './components/features/BroadcastView';
import { AnalyticsView } from './components/features/AnalyticsView';
import { TemplatesView } from './components/features/TemplatesView';
import { LogViewer } from './components/features/LogViewer';
import { ChatModal } from './components/features/ChatModal';
import { useDashboard } from './hooks/useDashboard';
import { useImport } from './hooks/useImport';
import { useConfig } from './hooks/useConfig';
import { Login } from './components/layout/Login';
import { Sidebar } from './components/layout/Sidebar';
import { PrivacyPolicy } from './components/features/PrivacyPolicy';
import { Loader2 } from 'lucide-react';
import type { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('logs') === 'true' ? 'logs' : 'overview';
  });
  const [isDedicatedLogs] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('logs') === 'true';
  });
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Listen for privacy policy event and URL deep-link
  useEffect(() => {
    const handleShowPrivacy = () => setShowPrivacy(true);
    window.addEventListener('show-privacy', handleShowPrivacy);

    // Initial check for deep link ?privacy
    const params = new URLSearchParams(window.location.search);
    if (params.has('privacy')) {
      setShowPrivacy(true);
    }

    return () => window.removeEventListener('show-privacy', handleShowPrivacy);
  }, []);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        console.error('Auth check failed');
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (email: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch {
      console.error('Logout failed');
    }
  };

  const {
    stats,
    leads,
    keywords,
    availability,
    loading,
    selectedLead,
    messages,
    isSendingMsg,
    fetchData,
    toggleAI,
    resolveHandover,
    sendMessage,
    setSelectedLead,
    setAvailability,
  } = useDashboard(selectedCampaignId);

  const {
    batches,
    selectedBatch,
    isImporting,
    fetchBatches,
    fetchBatchDetails,
    handleFileUpload,
    runAction,
    executeBatch,
    runReach,
    setSelectedBatch,
  } = useImport(fetchData);

  const {
    business,
    prompts,
    sequences,
    templates,
    telegram,
    metaAppId,
    fetchConfig,
    saveBusiness,
    savePrompt,
    saveSequence,
    saveTelegram,
    updateGlobalConfig,
    addKeyword,
    removeKeyword,
    setSequences,
  } = useConfig(selectedCampaignId);

  useEffect(() => {
    fetchData();
    fetchConfig();
  }, [fetchData, fetchConfig]);

  useEffect(() => {
    if (activeTab === 'import') {
      fetchBatches();
    }
  }, [activeTab, fetchBatches]);

  useEffect(() => {
    if (stats.length > 0 && !selectedCampaignId) {
      const firstId = stats[0].campaignId;
      setTimeout(() => setSelectedCampaignId(firstId), 0);
    }
  }, [stats, selectedCampaignId]);

  if (isAuthLoading) {
    return (
      <div className="loading-screen">
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  if (showPrivacy) {
    return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div
      className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isDedicatedLogs ? 'dedicated-view' : ''}`}
    >
      {!isDedicatedLogs && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          campaigns={stats}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={setSelectedCampaignId}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={handleLogout}
        />
      )}

      <div className="main-content">
        {!isDedicatedLogs && (
          <Header activeTab={activeTab} loading={loading} onRefresh={fetchData} />
        )}

        {activeTab === 'overview' && (
          <Overview
            stats={stats}
            leads={leads}
            onSelectLead={setSelectedLead}
            resolveHandover={resolveHandover}
          />
        )}

        {activeTab === 'settings' && (
          <AIAgents
            business={business}
            prompts={prompts}
            telegram={telegram}
            keywords={keywords}
            availability={availability}
            metaAppId={metaAppId}
            onSaveBusiness={saveBusiness}
            onSavePrompt={savePrompt}
            onSaveTelegram={saveTelegram}
            onUpdateAvailability={(status) => {
              setAvailability(status);
              updateGlobalConfig(status);
            }}
            onAddKeyword={async (word, type) => {
              if (await addKeyword(word, type)) fetchData();
            }}
            onRemoveKeyword={async (id) => {
              if (await removeKeyword(id)) fetchData();
            }}
          />
        )}

        {activeTab === 'campaign' && (
          <CampaignFlow
            sequences={sequences}
            onSave={saveSequence}
            onUpdateSequences={setSequences}
          />
        )}

        {activeTab === 'campaigns' && <CampaignManager />}

        {activeTab === 'broadcast' && <BroadcastView />}

        {activeTab === 'analytics' && <AnalyticsView />}

        {activeTab === 'templates' && <TemplatesView initialTemplates={templates} />}

        {activeTab === 'logs' && <LogViewer />}

        {activeTab === 'import' && (
          <ImportManager
            batches={batches}
            selectedBatch={selectedBatch}
            stats={stats}
            isImporting={isImporting}
            selectedCampaignId={selectedCampaignId}
            setSelectedCampaignId={setSelectedCampaignId}
            onSelectBatch={fetchBatchDetails}
            onBack={() => setSelectedBatch(null)}
            onFileUpload={handleFileUpload}
            onRunAction={runAction}
            onExecute={executeBatch}
            onRunReach={runReach}
            onRefresh={fetchData}
          />
        )}
      </div>

      {selectedLead && (
        <ChatModal
          lead={selectedLead}
          messages={messages}
          newMessage={newMessage}
          isSending={isSendingMsg}
          onSetNewMessage={setNewMessage}
          onSendMessage={(e) => {
            e.preventDefault();
            sendMessage(selectedLead.id, newMessage);
            setNewMessage('');
          }}
          onToggleAI={(enabled) => toggleAI(selectedLead.id, enabled)}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
}

export default App;
