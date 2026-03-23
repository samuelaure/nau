'use client';

import { useState } from 'react';
import { LogOut, Search, MessageSquare, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface SidebarProps {
  users: any[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ 
  users, 
  selectedUserId, 
  onSelectUser, 
  collapsed, 
  onToggleCollapse 
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(user => {
    const name = (user.displayName || user.firstName || '').toLowerCase();
    const telegramId = (user.telegramId?.toString() || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || telegramId.includes(searchQuery.toLowerCase());
  });

  return (
    <div className={`glass-card sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border-glass)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? '0' : '20px' }}>
          {!collapsed && <h2 className="glow-text" style={{ fontSize: '1.2rem', fontWeight: 800 }}>CHATS</h2>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => signOut()} 
              title="Cerrar Sesión"
              style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <LogOut size={18} />
            </button>
            <button 
              onClick={onToggleCollapse}
              style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>
        
        {!collapsed && (
          <div style={{ position: 'relative' }}>
            <input 
              className="input-field" 
              placeholder="Buscar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', fontSize: '0.85rem' }} 
            />
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredUsers.map((user: any) => (
          <div 
            key={user.id}
            onClick={() => onSelectUser(user.id)}
            className={`chat-item ${selectedUserId === user.id ? 'active' : ''}`}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              padding: collapsed ? '16px 0' : '16px 24px',
              alignItems: collapsed ? 'center' : 'stretch'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600, color: selectedUserId === user.id ? 'var(--primary)' : 'white' }}>
                {collapsed ? (user.displayName?.[0] || user.firstName?.[0]) : (user.displayName || user.firstName)}
              </span>
              {!collapsed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {user.messages?.[0] && formatDistanceToNow(new Date(user.messages[0].createdAt), { addSuffix: true, locale: es })}
                  </span>
                  <Settings size={14} className={selectedUserId === user.id ? 'glow-text' : ''} style={{ opacity: 0.6 }} />
                </div>
              )}
            </div>
            {!collapsed && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.messages?.[0]?.content || 'Sin mensajes'}
              </p>
            )}
          </div>
        ))}

        {filteredUsers.length === 0 && !collapsed && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            No se encontraron chats
          </div>
        )}
      </div>
    </div>
  );
}
