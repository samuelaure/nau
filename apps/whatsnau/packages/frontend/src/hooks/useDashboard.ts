import { useState, useEffect, useCallback } from 'react';
import type { CampaignStats, Lead, KeywordConfig, Message, TenantStats } from '../types';
import { useNotification } from '../context/NotificationContext';

export const useDashboard = (campaignId?: string) => {
  const { notify } = useNotification();
  const [stats, setStats] = useState<CampaignStats[]>([]);
  const [tenantStats, setTenantStats] = useState<TenantStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [keywords, setKeywords] = useState<KeywordConfig[]>([]);
  const [availability, setAvailability] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = '/api/dashboard';
      const leadsUrl = campaignId
        ? `${baseUrl}/leads?campaignId=${campaignId}&limit=100`
        : `${baseUrl}/leads?limit=100`;

      const [statsRes, leadsRes, keywordsRes, configRes, tenantStatsRes] = await Promise.all([
        fetch(`${baseUrl}/stats`),
        fetch(leadsUrl),
        fetch(`${baseUrl}/config/keywords`),
        fetch(`${baseUrl}/config/global`),
        fetch(`${baseUrl}/tenant-stats`),
      ]);

      const statsData = await statsRes.json();
      const leadsData = await leadsRes.json();
      const keywordsData = await keywordsRes.json();
      const configData = await configRes.json();
      const tenantStatsData = tenantStatsRes.ok ? await tenantStatsRes.json() : null;

      setStats(statsData);
      setTenantStats(tenantStatsData);
      // Handle both old format (array) and new format (object with data property)
      setLeads(Array.isArray(leadsData) ? leadsData : leadsData.data || []);
      setKeywords(keywordsData);
      setAvailability(configData.availabilityStatus || '');
    } catch (error) {
      console.error('Failed to fetch data:', error);
      notify('error', 'Dashboard sync failure. Check connection.');
    } finally {
      setLoading(false);
    }
  }, [notify, campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchMessages = useCallback(
    async (leadId: string) => {
      try {
        const res = await fetch(`/api/dashboard/leads/${leadId}/messages`);
        const data = await res.json();
        setMessages(data);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        notify('error', 'Failed to sync lead messages.');
      }
    },
    [notify]
  );

  const toggleAI = async (leadId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/ai-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiEnabled: enabled }),
      });
      if (!res.ok) throw new Error('Toggle failed');

      fetchData();
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, aiEnabled: enabled });
      }
      notify('success', `AI Agent ${enabled ? 'enabled' : 'disabled'} for lead.`);
    } catch (error) {
      console.error('Failed to toggle AI:', error);
      notify('error', 'AI toggle failed. Service might be busy.');
    }
  };

  const resolveHandover = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/leads/${id}/resolve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Resolve failed');
      fetchData();
      notify('success', 'Handover resolved. Agent resumed.');
    } catch (error) {
      console.error('Failed to resolve handover:', error);
      notify('error', 'Failed to resolve handover.');
    }
  };

  const sendMessage = async (leadId: string, content: string) => {
    setIsSendingMsg(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Send failed');
      fetchMessages(leadId);
      notify('success', 'Message sent via WhatsApp.');
    } catch (error) {
      console.error('Failed to send message:', error);
      notify('error', 'Message delivery failed. Check WhatsApp status.');
    } finally {
      setIsSendingMsg(false);
    }
  };

  useEffect(() => {
    const eventSource = new EventSource('/api/dashboard/events');
    eventSource.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      if (selectedLead && data.leadId === selectedLead.id) {
        fetchMessages(selectedLead.id);
      }
      fetchData();
    });
    eventSource.addEventListener('status', () => fetchData());
    eventSource.addEventListener('handover', () => {
      fetchData();
      notify('info', 'New human handover request received.');
    });
    eventSource.onerror = () => {
      console.warn('SSE connection lost. Retrying...');
    };
    return () => eventSource.close();
  }, [selectedLead, fetchData, fetchMessages, notify]);

  return {
    stats,
    tenantStats,
    leads,
    keywords,
    availability,
    loading,
    selectedLead,
    setSelectedLead,
    messages,
    isSendingMsg,
    fetchData,
    fetchMessages,
    toggleAI,
    resolveHandover,
    sendMessage,
    setAvailability,
  };
};
