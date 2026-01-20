import { useState, useEffect, useCallback } from 'react';
import type { CampaignStats, Lead, KeywordConfig, Message } from '../types';

export const useDashboard = () => {
    const [stats, setStats] = useState<CampaignStats[]>([]);
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
            const baseUrl = 'http://localhost:3000/api/dashboard';
            const [statsRes, leadsRes, keywordsRes, configRes] = await Promise.all([
                fetch(`${baseUrl}/stats`),
                fetch(`${baseUrl}/leads`),
                fetch(`${baseUrl}/config/keywords`),
                fetch(`${baseUrl}/config/global`),
            ]);

            const statsData = await statsRes.json();
            const leadsData = await leadsRes.json();
            const keywordsData = await keywordsRes.json();
            const configData = await configRes.json();

            setStats(statsData);
            setLeads(leadsData);
            setKeywords(keywordsData);
            setAvailability(configData.availabilityStatus || '');
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMessages = useCallback(async (leadId: string) => {
        try {
            const res = await fetch(`http://localhost:3000/api/dashboard/leads/${leadId}/messages`);
            const data = await res.json();
            setMessages(data);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    }, []);

    const toggleAI = async (leadId: string, enabled: boolean) => {
        try {
            await fetch(`http://localhost:3000/api/dashboard/leads/${leadId}/ai-toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiEnabled: enabled }),
            });
            fetchData();
            if (selectedLead && selectedLead.id === leadId) {
                setSelectedLead({ ...selectedLead, aiEnabled: enabled });
            }
        } catch (error) {
            console.error('Failed to toggle AI:', error);
        }
    };

    const resolveHandover = async (id: string) => {
        try {
            await fetch(`http://localhost:3000/api/dashboard/leads/${id}/resolve`, { method: 'POST' });
            fetchData();
        } catch (error) {
            console.error('Failed to resolve handover:', error);
        }
    };

    const sendMessage = async (leadId: string, content: string) => {
        setIsSendingMsg(true);
        try {
            await fetch(`http://localhost:3000/api/dashboard/leads/${leadId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            fetchMessages(leadId);
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSendingMsg(false);
        }
    };

    useEffect(() => {
        const eventSource = new EventSource('http://localhost:3000/api/dashboard/events');
        eventSource.addEventListener('message', (e) => {
            const data = JSON.parse(e.data);
            if (selectedLead && data.leadId === selectedLead.id) {
                fetchMessages(selectedLead.id);
            }
            fetchData();
        });
        eventSource.addEventListener('status', () => fetchData());
        eventSource.addEventListener('handover', () => fetchData());
        return () => eventSource.close();
    }, [selectedLead, fetchData, fetchMessages]);

    return {
        stats,
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
