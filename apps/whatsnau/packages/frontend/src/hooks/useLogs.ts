import { useState, useEffect } from 'react';
import type { LogEntry } from '../types';

export const useLogs = (maxLogs = 500) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/dashboard/events');

    eventSource.addEventListener('log', (e) => {
      try {
        const log = JSON.parse(e.data);
        setLogs((prev) => [log, ...prev].slice(0, maxLogs));
      } catch (err) {
        console.error('Failed to parse log event:', err);
      }
    });

    eventSource.onerror = () => {
      console.warn('SSE log connection lost. Retrying...');
    };

    return () => eventSource.close();
  }, [maxLogs]);

  const clearLogs = () => setLogs([]);

  return { logs, clearLogs };
};
