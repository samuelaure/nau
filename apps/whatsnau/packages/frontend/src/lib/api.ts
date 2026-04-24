/**
 * Centralized API client for making requests to the backend
 */

const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number>;
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${endpoint}`;

  // Add query parameters if provided
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Dashboard endpoints
  dashboard: {
    getStats: () => fetchApi('/dashboard/stats'),
    getLeads: (params?: { campaignId?: string; page?: number; limit?: number }) =>
      fetchApi('/dashboard/leads', { params }),
    getKeywords: () => fetchApi('/dashboard/config/keywords'),
    getGlobalConfig: () => fetchApi('/dashboard/config/global'),
    getCampaigns: (params?: { page?: number; limit?: number }) =>
      fetchApi('/dashboard/campaigns', { params }),
  },

  // Import endpoints
  import: {
    getBatches: (params?: { page?: number; limit?: number }) =>
      fetchApi('/dashboard/import/batches', { params }),
    getBatchDetails: (id: string) => fetchApi(`/dashboard/import/batches/${id}`),
    uploadCSV: (data: { campaignId: string; name: string; csvContent: string }) =>
      fetchApi('/dashboard/import/csv', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Lead endpoints
  leads: {
    getMessages: (leadId: string) => fetchApi(`/dashboard/leads/${leadId}/messages`),
    sendMessage: (leadId: string, content: string) =>
      fetchApi(`/dashboard/leads/${leadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    toggleAI: (leadId: string, aiEnabled: boolean) =>
      fetchApi(`/dashboard/leads/${leadId}/ai-toggle`, {
        method: 'POST',
        body: JSON.stringify({ aiEnabled }),
      }),
    resolve: (leadId: string) =>
      fetchApi(`/dashboard/leads/${leadId}/resolve`, {
        method: 'POST',
      }),
  },
};
