import { useState, useCallback } from 'react';
import type { BusinessConfig, PromptConfig, SequenceConfig, Template, TelegramConfig } from '../types';

export const useConfig = () => {
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
            const [bizRes, promptRes, seqRes, tempRes, teleRes] = await Promise.all([
                fetch(`${baseUrl}/business`),
                fetch(`${baseUrl}/prompts`),
                fetch(`${baseUrl}/sequences`),
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
        }
    }, []);

    const saveBusiness = async (data: BusinessConfig) => {
        try {
            await fetch('http://localhost:3000/api/dashboard/config/business', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            setBusiness(data);
            alert('Business profile updated');
        } catch (error) {
            console.error('Failed to save business:', error);
        }
    };

    const savePrompt = async (role: string, basePrompt: string) => {
        try {
            await fetch('http://localhost:3000/api/dashboard/config/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, basePrompt }),
            });
            alert(`${role} prompt updated`);
        } catch (error) {
            console.error('Failed to save prompt:', error);
        }
    };

    const saveSequence = async (id: string, name: string, waitHours: number) => {
        try {
            await fetch(`http://localhost:3000/api/dashboard/config/sequences/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, waitHours }),
            });
            fetchConfig();
            alert('Sequence updated');
        } catch (error) {
            console.error('Failed to save sequence:', error);
        }
    };

    const saveTelegram = async (data: TelegramConfig) => {
        try {
            await fetch('http://localhost:3000/api/dashboard/config/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            setTelegram(data);
            alert('Telegram settings updated');
        } catch (error) {
            console.error('Failed to save telegram:', error);
        }
    };

    const updateGlobalConfig = async (availabilityStatus: string) => {
        try {
            await fetch('http://localhost:3000/api/dashboard/config/global', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ availabilityStatus }),
            });
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const addKeyword = async (word: string, type: string) => {
        try {
            const res = await fetch('http://localhost:3000/api/dashboard/config/keywords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word, type }),
            });
            return res.ok;
        } catch (error) {
            console.error('Failed to add keyword:', error);
            return false;
        }
    };

    const removeKeyword = async (id: string) => {
        try {
            await fetch(`http://localhost:3000/api/dashboard/config/keywords/${id}`, {
                method: 'DELETE',
            });
            return true;
        } catch (error) {
            console.error('Failed to remove keyword:', error);
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
