import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useNotification } from '../context/NotificationContext';

/**
 * Query keys for cache management
 */
export const queryKeys = {
    stats: ['stats'] as const,
    leads: (campaignId?: string) => ['leads', campaignId] as const,
    keywords: ['keywords'] as const,
    globalConfig: ['globalConfig'] as const,
    campaigns: ['campaigns'] as const,
    batches: ['batches'] as const,
    batchDetails: (id: string) => ['batch', id] as const,
    messages: (leadId: string) => ['messages', leadId] as const,
};

/**
 * Hook to fetch dashboard stats
 */
export function useStats() {
    return useQuery({
        queryKey: queryKeys.stats,
        queryFn: api.dashboard.getStats,
    });
}

/**
 * Hook to fetch leads with optional campaign filter
 */
export function useLeads(campaignId?: string) {
    return useQuery({
        queryKey: queryKeys.leads(campaignId),
        queryFn: () => api.dashboard.getLeads({ campaignId, limit: 100 }),
    });
}

/**
 * Hook to fetch keywords
 */
export function useKeywords() {
    return useQuery({
        queryKey: queryKeys.keywords,
        queryFn: api.dashboard.getKeywords,
    });
}

/**
 * Hook to fetch global config
 */
export function useGlobalConfig() {
    return useQuery({
        queryKey: queryKeys.globalConfig,
        queryFn: api.dashboard.getGlobalConfig,
    });
}

/**
 * Hook to fetch campaigns
 */
export function useCampaigns() {
    return useQuery({
        queryKey: queryKeys.campaigns,
        queryFn: () => api.dashboard.getCampaigns({ limit: 50 }),
    });
}

/**
 * Hook to fetch import batches
 */
export function useBatches() {
    return useQuery({
        queryKey: queryKeys.batches,
        queryFn: () => api.import.getBatches({ limit: 50 }),
    });
}

/**
 * Hook to fetch messages for a lead
 */
export function useMessages(leadId: string | null) {
    return useQuery({
        queryKey: queryKeys.messages(leadId || ''),
        queryFn: () => api.leads.getMessages(leadId!),
        enabled: !!leadId,
    });
}

/**
 * Hook to toggle AI for a lead
 */
export function useToggleAI() {
    const queryClient = useQueryClient();
    const { notify } = useNotification();

    return useMutation({
        mutationFn: ({ leadId, aiEnabled }: { leadId: string; aiEnabled: boolean }) =>
            api.leads.toggleAI(leadId, aiEnabled),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.leads() });
            notify('success', `AI Agent ${variables.aiEnabled ? 'enabled' : 'disabled'} for lead.`);
        },
        onError: () => {
            notify('error', 'AI toggle failed. Service might be busy.');
        },
    });
}

/**
 * Hook to send a message to a lead
 */
export function useSendMessage() {
    const queryClient = useQueryClient();
    const { notify } = useNotification();

    return useMutation({
        mutationFn: ({ leadId, content }: { leadId: string; content: string }) =>
            api.leads.sendMessage(leadId, content),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.messages(variables.leadId) });
            notify('success', 'Message sent via WhatsApp.');
        },
        onError: () => {
            notify('error', 'Message delivery failed. Check WhatsApp status.');
        },
    });
}

/**
 * Hook to resolve handover
 */
export function useResolveHandover() {
    const queryClient = useQueryClient();
    const { notify } = useNotification();

    return useMutation({
        mutationFn: (leadId: string) => api.leads.resolve(leadId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.leads() });
            notify('success', 'Handover resolved. Agent resumed.');
        },
        onError: () => {
            notify('error', 'Failed to resolve handover.');
        },
    });
}
