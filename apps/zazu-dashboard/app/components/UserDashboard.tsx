'use client';

import { useSession } from 'next-auth/react';
import { Settings, Lock, Sparkles, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default function UserDashboard() {
  const { data: session } = useSession();
  
  // Right now, hardcoding available features for the UI
  // In the future this should be dynamically loaded 
  const availableFeatures = [
    {
      id: 'comment-suggester',
      name: 'Smart Comment Suggester',
      description: 'Interactúa automáticamente con autenticidad en Instagram. Define tus Brand Guidelines y Zazŭ hará el resto.',
      icon: <MessageCircle size={24} />,
      active: true, // We assume true for this MVP release so the user can reach it
      href: '/brands',
    },
    {
      id: 'auto-dm',
      name: 'Ventas por DM (Próximamente)',
      description: 'Zazŭ responde DMs, califica leads y cierra ventas automáticamente 24/7.',
      icon: <Sparkles size={24} />,
      active: false,
      href: '#',
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>
          Bienvenido, {session?.user?.name || 'Comandante'}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Selecciona un módulo activo para configurarlo o explora nuevas herramientas.
        </p>
      </header>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px', 
        width: '100%' 
      }}>
        {availableFeatures.map((feature) => (
          feature.active ? (
            <Link key={feature.id} href={feature.href} style={{ textDecoration: 'none' }}>
              <div 
                className="glass-card" 
                style={{ 
                  padding: '24px', 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '16px', 
                  cursor: 'pointer',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ 
                  background: 'rgba(0, 255, 136, 0.1)', 
                  padding: '12px', 
                  borderRadius: '12px',
                  color: 'var(--primary)' 
                }}>
                  {feature.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.1rem', fontWeight: 600 }}>{feature.name}</h3>
                    <span style={{ fontSize: '0.7rem', background: 'var(--primary)', color: '#000', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      ACTIVO
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                    {feature.description}
                  </p>
                </div>
                <div style={{ alignSelf: 'center', color: 'var(--text-dim)' }}>
                  <Settings size={20} />
                </div>
              </div>
            </Link>
          ) : (
            <div 
              key={feature.id}
              className="glass-card" 
              style={{ 
                padding: '24px', 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '16px', 
                opacity: 0.7,
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                padding: '12px', 
                borderRadius: '12px',
                color: 'var(--text-dim)' 
              }}>
                <Lock size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.1rem', fontWeight: 600 }}>{feature.name}</h3>
                </div>
                <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                  {feature.description}
                </p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
