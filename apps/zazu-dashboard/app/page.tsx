/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Loader2, MonitorSmartphone, ShieldAlert } from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('admin');

  if (status === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  const isAdmin = session?.user?.isAdmin === true;
  const isActuallyShowingAdmin = isAdmin && viewMode === 'admin';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Global View Switcher for Admins */}
      {isAdmin && (
        <div style={{ 
          background: 'var(--surface)', 
          borderBottom: '1px solid var(--border-glass)', 
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>MODO DE VISTA:</span>
          <button 
            onClick={() => setViewMode('admin')}
            style={{ 
              background: viewMode === 'admin' ? 'rgba(255, 68, 68, 0.15)' : 'transparent',
              border: `1px solid ${viewMode === 'admin' ? '#ff4444' : 'transparent'}`,
              color: viewMode === 'admin' ? '#ff4444' : 'var(--text-dim)',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <ShieldAlert size={14} /> ADMINISTRADOR
          </button>
          <button 
            onClick={() => setViewMode('user')}
            style={{ 
              background: viewMode === 'user' ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
              border: `1px solid ${viewMode === 'user' ? 'var(--primary)' : 'transparent'}`,
              color: viewMode === 'user' ? 'var(--primary)' : 'var(--text-dim)',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <MonitorSmartphone size={14} /> USUARIO ESTÁNDAR
          </button>
        </div>
      )}

      {/* Render the selected view */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {isActuallyShowingAdmin ? (
          <AdminDashboard />
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <UserDashboard />
          </div>
        )}
      </div>
    </div>
  );
}
