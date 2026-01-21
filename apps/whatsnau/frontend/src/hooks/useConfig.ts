import { useState, useCallback, useEffect } from 'react';
import type {
  BusinessConfig,
  PromptConfig,
  SequenceConfig,
  Template,
  TelegramConfig,
} from '../types';
import { useNotification } from '../context/NotificationContext';

export const useConfig = (campaignId?: string) => {
  const { notify } = useNotification();
  const [business, setBusiness] = useState<BusinessConfig>({ name: '', knowledgeBase: '' });
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [sequences, setSequences] = useState<SequenceConfig[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [telegram, setTelegram] = useState<TelegramConfig>({
    botToken: '',
    chatId: '',
    isEnabled: false,
  });

  const fetchConfig = useCallback(async () => {
    try {
      const baseUrl = 'http://localhost:3000/api/dashboard/config';
      const promptUrl = campaignId ? `${baseUrl}/prompts?campaignId=${campaignId}` : `${baseUrl}/prompts`;
      const seqUrl = campaignId ? `${baseUrl}/sequences?campaignId=${campaignId}` : `${baseUrl}/sequences`;

      const [bizRes, promptRes, seqRes, tempRes, teleRes] = await Promise.all([
        fetch(`${baseUrl}/business`),
        fetch(promptUrl),
        fetch(seqUrl),
        fetch(`${baseUrl}/whatsapp-templates`),
        fetch(`${baseUrl}/telegram`),
      ]);
      setBusiness(await bizRes.json());
      setPrompts(await promptRes.json());
      setSequences(await seqRes.json());
      const tempData = await tempRes.json();
      setTemplates(tempData.data || []);
      setTelegram(await teleRes.json());
    } catch (error) {
      console.error('Failed to fetch config:', error);
      notify('error', 'Configuration sync failed.');
    }
  }, [notify, campaignId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveBusiness = async (data: BusinessConfig) => {
    try {
      const res = await fetch('http://localhost:3000/api/dashboard/config/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Save failed');
      setBusiness(data);
      notify('success', 'Business knowledge base updated.');
    } catch (error) {
      console.error('Failed to save business:', error);
      notify('error', 'Failed to save business profile.');
    }
  };

  const savePrompt = async (role: string, basePrompt: string) => {
    if (!campaignId) return notify('error', 'Select a campaign first');
    try {
      const res = await fetch('http://localhost:3000/api/dashboard/config/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, basePrompt, campaignId }),
      });
      if (!res.ok) throw new Error('Save failed');
      notify('success', `${role} system prompt synchronized.`);
    } catch (error) {
      console.error('Failed to save prompt:', error);
      notify('error', `Failed to update ${role} prompt.`);
    }
  };

  const saveSequence = async (id: string, name: string, waitHours: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dashboard/config/sequences/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, waitHours }),
      });
      if (!res.ok) throw new Error('Save failed');
      fetchConfig();
      notify('success', 'Timeline sequence updated.');
    } catch (error) {
      console.error('Failed to save sequence:', error);
      notify('error', 'Failed to update campaign sequence.');
    }
  };

  const saveTelegram = async (data: TelegramConfig) => {
    try {
      const res = await fetch('http://localhost:3000/api/dashboard/config/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Save failed');
      setTelegram(data);
      notify('success', 'Telegram alert settings updated.');
    } catch (error) {
      console.error('Failed to save telegram:', error);
      notify('error', 'Failed to save Telegram credentials.');
    }
  };

  const updateGlobalConfig = async (availabilityStatus: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/dashboard/config/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilityStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
      notify('info', `Availability updated: ${availabilityStatus}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      notify('error', 'Failed to update availability status.');
    }
  };

  const addKeyword = async (word: string, type: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/dashboard/config/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, type }),
      });
      if (res.ok) {
        notify('success', `Handover keyword '${word}' added.`);
        return true;
      }
      throw new Error('Add failed');
    } catch (error) {
      console.error('Failed to add keyword:', error);
      notify('error', 'Failed to register new keyword.');
      return false;
    }
  };

  const removeKeyword = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dashboard/config/keywords/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        notify('info', 'Keyword removed.');
        return true;
      }
      throw new Error('Remove failed');
    } catch (error) {
      console.error('Failed to remove keyword:', error);
      notify('error', 'Failed to remove keyword.');
      return false;
    }
  };

  return {
    business,
    prompts,
    sequences,
    templates,
    telegram,
    setBusiness,
    setPrompts,
    setSequences,
    setTemplates,
    setTelegram,
    fetchConfig,
    saveBusiness,
    savePrompt,
    saveSequence,
    saveTelegram,
    updateGlobalConfig,
    addKeyword,
    removeKeyword,
  };
};
