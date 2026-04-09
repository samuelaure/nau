'use client';

import { useEffect, useState } from 'react';
import { useTelegram } from '../components/TelegramProvider';
import { Plus, Settings2, Trash2, Globe, ShieldCheck, Zap, ArrowLeft, MoreHorizontal, ChevronRight } from 'lucide-react';
import { getBrands, upsertBrand, removeBrandTarget, addBrandTargets } from '../lib/actions';
import Link from 'next/link';

export default function ClientBrandsList({ initialBrands }: { initialBrands: any[] }) {
  const { isReady, user } = useTelegram();
  const [brands, setBrands] = useState(initialBrands);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [newTarget, setNewTarget] = useState('');

  useEffect(() => {
    if (isReady && typeof window !== 'undefined') {
      const WebApp = require('@twa-dev/sdk').default;
      WebApp.MainButton.setText('NUEVA MARCA');
      if (isAdding || selectedBrand) {
        WebApp.MainButton.hide();
      } else {
        WebApp.MainButton.show();
        WebApp.MainButton.onClick(() => setIsAdding(true));
      }

      return () => {
        WebApp.MainButton.hide();
      };
    }
  }, [isReady, isAdding, selectedBrand]);

  if (!isReady) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Zap className="glow-text animate-pulse" size={48} color="var(--primary)" />
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '32px' }}>
        <Link href="/" style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px', 
          color: 'var(--primary)', 
          textDecoration: 'none',
          fontSize: '0.8rem',
          fontWeight: 700,
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          <ArrowLeft size={14} /> Volver al Panel
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>Mis Marcas</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Gestiona la identidad y objetivos de tu IA.</p>
          </div>
          <div style={{ 
            background: 'rgba(0, 255, 136, 0.1)', 
            padding: '12px', 
            borderRadius: '50%',
            color: 'var(--primary)',
            border: '1px solid var(--primary)'
          }}>
            <Globe size={24} />
          </div>
        </div>
      </header>

      {/* Adding Brand Form */}
      {isAdding && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid var(--primary)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
             <Plus size={20} color="var(--primary)" /> Configurar Nueva Marca
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase' }}>Nombre de la Marca</label>
              <input 
                className="input-field" 
                placeholder="Ej: Samuel Aure Personal" 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase' }}>Tono y Directrices (Prompt)</label>
              <textarea 
                className="input-field" 
                style={{ minHeight: '120px', resize: 'none' }}
                placeholder="Ej: Responde siempre de forma motivadora, usa emojis de tecnología..." 
                value={newPrompt}
                onChange={e => setNewPrompt(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                className="btn-primary" 
                style={{ flex: 1 }}
                onClick={async () => {
                   const res = await upsertBrand({ brandName: newName, tonePrompt: newPrompt, isActive: true });
                   if (res.success) {
                     const updated = await getBrands();
                     setBrands(updated);
                     setIsAdding(false);
                     setNewName('');
                     setNewPrompt('');
                   }
                }}
              >Guardar Marca</button>
              <button 
                onClick={() => setIsAdding(false)}
                style={{ background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text)', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer' }}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Brand Details / Targets */}
      {selectedBrand && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid var(--secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings2 size={20} /> {selectedBrand.brandName}
            </h2>
            <button 
              onClick={() => setSelectedBrand(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >CERRAR</button>
          </div>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '12px', textTransform: 'uppercase' }}>Monitorear Cuentas</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input 
                className="input-field" 
                placeholder="Usuario Instagram (ej: elonmusk)" 
                value={newTarget}
                onChange={e => setNewTarget(e.target.value)}
                style={{ padding: '10px 14px' }}
              />
              <button 
                className="btn-primary"
                style={{ padding: '0 16px' }}
                onClick={async () => {
                  if (!newTarget) return;
                  await addBrandTargets(selectedBrand.id, [newTarget]);
                  const updated = await getBrands();
                  setBrands(updated);
                  setSelectedBrand(updated.find((b: any) => b.id === selectedBrand.id));
                  setNewTarget('');
                }}
              ><Plus size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedBrand.targets?.map((t: any) => (
                <div key={t.username} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  padding: '10px 16px', 
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>@{t.username}</span>
                  <button 
                    onClick={async () => {
                      await removeBrandTarget(selectedBrand.id, t.username);
                      const updated = await getBrands();
                      setBrands(updated);
                      setSelectedBrand(updated.find((b: any) => b.id === selectedBrand.id));
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255, 68, 68, 0.5)', cursor: 'pointer' }}
                  ><Trash2 size={16} /></button>
                </div>
              ))}
              {(!selectedBrand.targets || selectedBrand.targets.length === 0) && (
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-dim)', padding: '10px' }}>No hay objetivos configurados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Brands List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {brands.map((brand: any) => (
          <div 
            key={brand.id} 
            onClick={() => setSelectedBrand(brand)}
            className="glass-card"
            style={{ 
              padding: '20px', 
              cursor: 'pointer', 
              transition: 'all 0.2s',
              borderLeft: brand.isActive ? '4px solid var(--primary)' : '4px solid var(--text-dim)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 6px' }}>
                  {brand.brandName}
                  {brand.isActive && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} />}
                </h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '12px', opacity: 0.8, lineClamp: 1, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  "{brand.tonePrompt}"
                </p>
              </div>
              <ChevronRight size={20} color="var(--text-dim)" />
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                 <ShieldCheck size={14} color="var(--primary)" /> {brand.targets?.length || 0} OBJETIVOS
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                 <Zap size={14} color="var(--secondary)" /> IA ACTIVA
               </div>
            </div>
          </div>
        ))}

        {brands.length === 0 && !isAdding && (
          <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center' }}>
            <Zap size={48} color="var(--primary)" style={{ margin: '0 auto 20px', opacity: 0.3 }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>No hay marcas</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Pulsa el botón de abajo para configurar tu primera identidad.</p>
            <button 
              className="btn-primary" 
              style={{ marginTop: '24px' }}
              onClick={() => setIsAdding(true)}
            >Añadir Identidad</button>
          </div>
        )}
      </div>
      
      {/* Mobile spacing for Main Button */}
      <div style={{ height: '80px' }} />
    </div>
  );
}
