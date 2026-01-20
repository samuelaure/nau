import { useState, useCallback } from 'react';
import type { ImportBatch } from '../types';

export const useImport = (fetchData: () => void) => {
    const [batches, setBatches] = useState<ImportBatch[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const fetchBatches = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3000/api/dashboard/import/batches');
            setBatches(await res.json());
        } catch (error) {
            console.error('Failed to fetch batches:', error);
        }
    }, []);

    const fetchBatchDetails = useCallback(async (id: string) => {
        try {
            const res = await fetch(`http://localhost:3000/api/dashboard/import/batches/${id}`);
            setSelectedBatch(await res.json());
        } catch (error) {
            console.error('Failed to fetch batch details:', error);
        }
    }, []);

    const handleFileUpload = async (campaignId: string, file: File) => {
        if (!campaignId) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const csvContent = event.target?.result as string;
            const name = file.name.replace('.csv', '');
            setIsImporting(true);
            try {
                await fetch('http://localhost:3000/api/dashboard/import/csv', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaignId, name, csvContent }),
                });
                fetchBatches();
            } catch (error) {
                console.error('Import failed:', error);
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsText(file);
    };

    const runAction = async (batchId: string, action: string) => {
        try {
            await fetch(`http://localhost:3000/api/dashboard/import/batches/${batchId}/${action}`, {
                method: 'POST',
            });
            fetchBatchDetails(batchId);
        } catch (error) {
            console.error(`Action ${action} failed:`, error);
        }
    };

    const executeBatch = async (batchId: string) => {
        if (!confirm('Are you sure you want to move these leads to the live campaign?')) return;
        try {
            await fetch(`http://localhost:3000/api/dashboard/import/batches/${batchId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadIds: null }),
            });
            fetchBatches();
            fetchBatchDetails(batchId);
            fetchData();
        } catch (error) {
            console.error('Execution failed:', error);
        }
    };

    const runReach = async (batchId: string) => {
        if (!confirm('This will send the first WhatsApp message to all leads in this batch. Proceed?'))
            return;
        try {
            await fetch(`http://localhost:3000/api/dashboard/import/batches/${batchId}/reach`, {
                method: 'POST',
            });
            alert('Outreach triggered successfully');
            setSelectedBatch(null);
            fetchBatches();
        } catch (error) {
            console.error('Reach failed:', error);
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
