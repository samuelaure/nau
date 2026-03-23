'use client';

import { Settings, User as UserIcon, Zap, Clock, Shield, X } from 'lucide-react';
import { format } from 'date-fns';
import { UserWithFeatures } from '../lib/types';

interface SettingsPanelProps {
  user: UserWithFeatures | null;
  onToggleFeature: (featureId: string) => Promise<void>;
  onClose: () => void;
}

export default function SettingsPanel({ 
  user, 
  onToggleFeature,
  onClose
}: SettingsPanelProps) {
  
  if (!user) {
    return (
      <div className="glass-card settings-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', position: 'relative' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
        <Settings size={60} style={{ opacity: 0.1 }} />
      </div>
    );
  }

  const features = [
    { id: 'ai_chat', name: 'Inteligencia Conversacional', icon: <Zap size={14} /> },
    { id: 'translator', name: 'Traducción Multi-idioma', icon: <Clock size={14} /> },
    { id: 'scrapper', name: 'Extracción de Datos', icon: <Shield size={14} /> }
  ];

  return (
    <div className="glass-card settings-panel" style={{ position: 'relative' }}>
      <button 
        onClick={onClose}
        style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
      >
        <X size={20} />
      </button>

      <h2 className="glow-text" style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '30px' }}>DETALLES DEL SUJETO</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <UserIcon size={20} color="var(--primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>INFORMACIÓN BASE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Telegram:</span> 
              <div style={{ textAlign: 'right' }}>
                <div>ID: {user.telegramId}</div>
                {user.username && <div style={{ color: 'var(--primary)', fontSize: '0.75rem' }}>@{user.username}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Registro:</span> 
              <span>{format(new Date(user.createdAt), 'dd/MM/yyyy')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Estado:</span> 
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{user.onboardingState}</span>
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Zap size={20} color="var(--secondary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>MÓDULOS ACTIVOS</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {features.map(feature => {
              const isActive = (user.features as string[])?.includes(feature.id);
              return (
                <div 
                  key={feature.id}
                  onClick={() => onToggleFeature(feature.id)}
                  className={`feature-card ${isActive ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {feature.icon}
                    <span style={{ fontSize: '0.8rem' }}>{feature.name}</span>
                  </div>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    border: '1px solid var(--primary)',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    transition: 'all 0.2s'
                  }} />
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '16px', fontStyle: 'italic' }}>
            * Los módulos con ID {features.map(f => f.id).join(', ')} están vinculados al motor nuclear de Zazŭ.
          </p>
        </div>
      </div>
    </div>
  );
}
