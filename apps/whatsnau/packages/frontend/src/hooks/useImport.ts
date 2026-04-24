import { useState, useCallback } from 'react';
import type { ImportBatch } from '../types';
import { useNotification } from '../context/NotificationContext';

export const useImport = (fetchData: () => void) => {
  const { notify } = useNotification();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/import/batches?limit=50');
      const data = await res.json();
      // Handle both old format (array) and new format (object with data property)
      setBatches(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      notify('error', 'Failed to load import batches.');
    }
  }, [notify]);

  const fetchBatchDetails = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/dashboard/import/batches/${id}`);
        const data = await res.json();
        setSelectedBatch(data);
      } catch (error) {
        console.error('Failed to fetch batch details:', error);
        notify('error', 'Failed to load batch details.');
      }
    },
    [notify]
  );

  const handleFileUpload = async (campaignId: string, file: File) => {
    if (!campaignId) {
      notify('info', 'Please select a campaign first.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvContent = event.target?.result as string;
      const name = file.name.replace('.csv', '');
      setIsImporting(true);
      try {
        const res = await fetch('/api/dashboard/import/csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId, name, csvContent }),
        });
        if (!res.ok) throw new Error('Import failed');

        const data = await res.json();

        if (data.isDuplicate) {
          notify(
            'info',
            `Duplicate file detected. ${data.message || 'This file was already imported.'}`
          );
        } else {
          notify('success', 'CSV processed and staged for analysis.');
        }

        fetchBatches();
      } catch (error) {
        console.error('Import failed:', error);
        notify('error', 'CSV mapping failed. Check column headers.');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const runAction = async (batchId: string, action: string) => {
    try {
      const res = await fetch(`/api/dashboard/import/batches/${batchId}/${action}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Action failed');
      notify('info', `Background ${action} started.`);
      fetchBatchDetails(batchId);
    } catch (error) {
      console.error(`Action ${action} failed:`, error);
      notify('error', `Process '${action}' failed to start.`);
    }
  };

  const executeBatch = async (batchId: string) => {
    if (!confirm('Are you sure you want to move these leads to the live campaign?')) return;
    try {
      const res = await fetch(`/api/dashboard/import/batches/${batchId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: null }),
      });
      if (!res.ok) throw new Error('Execution failed');
      notify('success', 'Leads integrated into campaign sequence.');
      fetchBatches();
      fetchBatchDetails(batchId);
      fetchData();
    } catch (error) {
      console.error('Execution failed:', error);
      notify('error', 'Lead integration failed. Data remains staged.');
    }
  };

  const runReach = async (batchId: string) => {
    if (!confirm('This will send the first WhatsApp message to all leads in this batch. Proceed?'))
      return;
    try {
      const res = await fetch(`/api/dashboard/import/batches/${batchId}/reach`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Reach failed');
      notify('success', 'Outreach campaign triggered. Sending WhatsApp messages...');
      setSelectedBatch(null);
      fetchBatches();
    } catch (error) {
      console.error('Reach failed:', error);
      notify('error', 'Failed to trigger outreach.');
    }
  };

  return {
    batches,
    selectedBatch,
    setSelectedBatch,
    isImporting,
    fetchBatches,
    fetchBatchDetails,
    handleFileUpload,
    runAction,
    executeBatch,
    runReach,
  };
};
