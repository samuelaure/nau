'use client';

import { Settings, User as UserIcon, Zap, Clock, Shield } from 'lucide-react';

interface SettingsPanelProps {
  user: any | null;
  onToggleFeature: (featureId: string) => Promise<void>;
}

export default function SettingsPanel({ 
  user, 
  onToggleFeature 
}: SettingsPanelProps) {
  
  if (!user) {
    return (
      <div className="glass-card settings-panel" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
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
    <div className="glass-card settings-panel">
      <h2 className="glow-text" style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '30px' }}>DETALLES DEL SUJETO</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <UserIcon size={20} color="var(--primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>INFORMACIÓN BASE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Telegram ID:</span> 
              <span>{user.telegramId}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Registro:</span> 
              <span>{new Date(user.createdAt).toLocaleDateString()}</span>
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
        </div>
      </div>
    </div>
  );
}
