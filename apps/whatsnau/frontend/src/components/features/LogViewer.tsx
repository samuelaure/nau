import React, { useState } from 'react';
import { useLogs } from '../../hooks/useLogs';
import { Trash2, Terminal, Search, Filter, AppWindow } from 'lucide-react';

export const LogViewer: React.FC = () => {
  const { logs, clearLogs } = useLogs();
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | null>(null);

  const getLevelLabel = (level: number) => {
    if (level >= 50) return { label: 'ERROR', class: 'error' };
    if (level >= 40) return { label: 'WARN', class: 'warn' };
    if (level >= 30) return { label: 'INFO', class: 'info' };
    return { label: 'DEBUG', class: 'debug' };
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.msg.toLowerCase().includes(filter.toLowerCase()) ||
      JSON.stringify(log).toLowerCase().includes(filter.toLowerCase());
    const matchesLevel = levelFilter ? log.level === levelFilter : true;
    return matchesSearch && matchesLevel;
  });

  const openInNewWindow = () => {
    window.open('/?logs=true', '_blank', 'width=1000,height=800');
  };

  return (
    <div className="log-viewer">
      <div className="feature-header">
        <div className="header-icon">
          <Terminal size={24} />
        </div>
        <div className="header-info">
          <h2>System Logs Live</h2>
          <p>Real-time backend activity and debugging stream.</p>
        </div>
        <div className="header-actions">
          <button onClick={openInNewWindow} className="secondary" title="Open in dedicated window">
            <AppWindow size={18} />
            <span>Dedicated View</span>
          </button>
          <button onClick={clearLogs} className="secondary danger">
            <Trash2 size={18} />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      <div className="log-controls">
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="level-filters">
          <Filter size={18} style={{ marginRight: '0.5rem', opacity: 0.5 }} />
          {[30, 40, 50].map((level) => (
            <button
              key={level}
              className={`filter-chip ${levelFilter === level ? 'active' : ''}`}
              onClick={() => setLevelFilter(levelFilter === level ? null : level)}
            >
              {getLevelLabel(level).label}
            </button>
          ))}
        </div>
      </div>

      <div className="log-container">
        {filteredLogs.length === 0 ? (
          <div className="empty-logs">
            <Terminal size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>No logs matching your criteria. Activity will appear here live.</p>
          </div>
        ) : (
          filteredLogs.map((log, i) => {
            const levelInfo = getLevelLabel(log.level);
            return (
              <div key={i} className={`log-entry ${levelInfo.class}`}>
                <span className="log-time">{new Date(log.time).toLocaleTimeString()}</span>
                <span className={`log-level ${levelInfo.class}`}>{levelInfo.label}</span>
                <span className="log-msg">{log.msg}</span>
                {Object.keys(log).filter(
                  (k) => !['level', 'time', 'msg', 'pid', 'hostname', 'reqId'].includes(k)
                ).length > 0 && (
                  <pre className="log-details">
                    {JSON.stringify(
                      Object.fromEntries(
                        Object.entries(log).filter(
                          ([k]) => !['level', 'time', 'msg', 'pid', 'hostname', 'reqId'].includes(k)
                        )
                      ),
                      null,
                      2
                    )}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .log-viewer {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 1.5rem;
        }
        .log-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }
        .search-bar {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          display: flex;
          align-items: center;
          padding: 0 1rem;
          gap: 0.75rem;
        }
        .search-bar input {
          background: transparent;
          border: none;
          color: white;
          padding: 0.75rem 0;
          width: 100%;
          outline: none;
        }
        .level-filters {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .filter-chip {
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.2s;
        }
        .filter-chip:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .filter-chip.active {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }
        .log-container {
          flex: 1;
          background: #0d1117;
          border-radius: 12px;
          padding: 1rem;
          overflow-y: auto;
          font-family: 'Fira Code', 'Courier New', monospace;
          font-size: 0.85rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
        }
        .log-entry {
          padding: 0.25rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: flex-start;
        }
        .log-time {
          color: #6e7681;
          min-width: 85px;
        }
        .log-level {
          font-weight: bold;
          min-width: 50px;
        }
        .log-level.info { color: #58a6ff; }
        .log-level.warn { color: #d29922; }
        .log-level.error { color: #f85149; }
        .log-level.debug { color: #8b949e; }
        .log-msg {
          color: #c9d1d9;
          flex: 1;
          word-break: break-word;
        }
        .log-details {
          width: 100%;
          margin: 0.5rem 0 0.5rem 8rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          color: #8b949e;
          font-size: 0.75rem;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        .empty-logs {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
};
