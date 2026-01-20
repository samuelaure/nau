import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Overview } from './components/features/Overview';
import { AIAgents } from './components/features/AIAgents';
import { ImportManager } from './components/features/ImportManager';
import { CampaignFlow } from './components/features/CampaignFlow';
import { CampaignManager } from './components/features/CampaignManager';
import { BroadcastView } from './components/features/BroadcastView';
import { TemplatesView } from './components/features/TemplatesView';
import { ChatModal } from './components/features/ChatModal';
import { useDashboard } from './hooks/useDashboard';
import { useImport } from './hooks/useImport';
import { useConfig } from './hooks/useConfig';

function App() {
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
  } = useDashboard();

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
    fetchConfig,
    saveBusiness,
    savePrompt,
    saveSequence,
    saveTelegram,
    updateGlobalConfig,
    addKeyword,
    removeKeyword,
    setSequences,
  } = useConfig();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'settings' | 'campaign' | 'campaigns' | 'broadcast' | 'templates' | 'import'
  >('overview');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [newMessage, setNewMessage] = useState('');

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

  return (
    <div className="dashboard-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        loading={loading}
        onRefresh={fetchData}
      />

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

      {activeTab === 'templates' && <TemplatesView initialTemplates={templates} />}

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
        />
      )}

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
