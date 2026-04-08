'use client';

import { useEffect, useState } from 'react';
import { useTelegram } from '../components/TelegramProvider';
import { Plus, Settings2, Trash2, Globe, ShieldCheck, Zap } from 'lucide-react';
import { getBrands, upsertBrand, removeBrandTarget, addBrandTargets } from '../lib/actions';

export default function ClientBrandsList({ initialBrands }: { initialBrands: any[] }) {
  const { isReady, user } = useTelegram();
  const [brands, setBrands] = useState(initialBrands);
  const [isAdding, setIsAdding] = useState(false);
  
  // States for new brand
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  useEffect(() => {
    if (isReady && typeof window !== 'undefined') {
      const WebApp = require('@twa-dev/sdk').default;
      WebApp.MainButton.setText('NUEVA MARCA');
      WebApp.MainButton.show();
      WebApp.MainButton.onClick(() => setIsAdding(true));

      return () => {
        WebApp.MainButton.hide();
      };
    }
  }, [isReady]);

  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [newTarget, setNewTarget] = useState('');

  if (!isReady) return <div className="p-8 text-center">Cargando Zazŭ...</div>;

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold glow-text">Mis Marcas</h1>
          <p className="text-sm text-slate-400">Gestiona tu inteligencia de engagement</p>
        </div>
        <div className="bg-primary/20 p-3 rounded-full">
          <Globe className="text-primary" size={24} />
        </div>
      </header>

      {brands.length === 0 && !isAdding && (
        <div className="glass-card p-12 text-center space-y-4">
          <div className="flex justify-center">
            <Zap className="text-primary animate-pulse" size={48} />
          </div>
          <h2 className="text-xl font-bold">No hay marcas todavía</h2>
          <p className="text-slate-400">Añade tu primera marca para empezar a recibir sugerencias de comentarios IA.</p>
        </div>
      )}

      {selectedBrand && (
        <div className="glass-card p-6 space-y-4 border-secondary/50">
          <div className="flex justify-between">
            <h2 className="text-xl font-extrabold uppercase text-secondary tracking-wide">
              {selectedBrand.brandName}
            </h2>
            <button onClick={() => setSelectedBrand(null)} className="text-slate-500 hover:text-white">Cerrar</button>
          </div>
          
          <div className="space-y-4">
            <section>
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Cuentas Monitoreadas</label>
              <div className="flex gap-2 mb-4">
                <input 
                  className="input-field py-2" 
                  placeholder="Usuario de Instagram (ej: karendev)" 
                  value={newTarget}
                  onChange={e => setNewTarget(e.target.value)}
                />
                <button 
                  className="btn-primary py-2 px-4"
                  onClick={async () => {
                    if (!newTarget) return;
                    await addBrandTargets(selectedBrand.id, [newTarget]);
                    const updated = await getBrands();
                    setBrands(updated);
                    setSelectedBrand(updated.find((b: any) => b.id === selectedBrand.id));
                    setNewTarget('');
                  }}
                ><Plus size={18} /></button>
              </div>

              <div className="space-y-2">
                {selectedBrand.targets?.map((t: any) => (
                  <div key={t.username} className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
                    <span className="text-sm">@{t.username}</span>
                    <button 
                      onClick={async () => {
                        await removeBrandTarget(selectedBrand.id, t.username);
                        const updated = await getBrands();
                        setBrands(updated);
                        setSelectedBrand(updated.find((b: any) => b.id === selectedBrand.id));
                      }}
                      className="text-red-500/50 hover:text-red-500"
                    ><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="glass-card p-6 space-y-4 border-primary/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plus size={20} className="text-primary" /> Crear Marca
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Nombre</label>
              <input 
                className="input-field" 
                placeholder="Ej: Mi Marca Personal" 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">System Prompt (Tono)</label>
              <textarea 
                className="input-field min-h-[120px]" 
                placeholder="Ej: Eres un experto en marketing... responde de forma amigable..." 
                value={newPrompt}
                onChange={e => setNewPrompt(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button 
                className="btn-primary w-full"
                onClick={async () => {
                   const res = await upsertBrand({ brandName: newName, tonePrompt: newPrompt, isActive: true });
                   if (res.success) {
                     const updated = await getBrands();
                     setBrands(updated);
                     setIsAdding(false);
                     setNewName('');
                     setNewPrompt('');
                   } else {
                     if (typeof window !== 'undefined') {
                       const WebApp = require('@twa-dev/sdk').default;
                       WebApp.showAlert('Error: ' + res.error);
                     } else {
                       alert('Error: ' + res.error);
                     }
                   }
                }}
              >Guardar</button>
              <button 
                className="p-3 glass-card hover:bg-red-500/20 text-red-500 border-red-500/30"
                onClick={() => setIsAdding(false)}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {brands.map((brand: any) => (
          <div 
            key={brand.id} 
            onClick={() => setSelectedBrand(brand)}
            className="glass-card p-5 hover:border-primary/30 transition-all group cursor-pointer"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  {brand.brandName}
                  {brand.isActive ? (
                    <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-[250px] line-clamp-2 italic">"{brand.tonePrompt}"</p>
              </div>
              <button className="text-slate-500 group-hover:text-primary transition-colors">
                <Settings2 size={20} />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-500">
               <div className="flex items-center gap-1">
                 <ShieldCheck size={14} className="text-primary" />
                 {brand.targets?.length || 0} Objetivos
               </div>
               <div className="flex items-center gap-1">
                 <Zap size={14} className="text-secondary" />
                 IA Activa
               </div>
            </div>
            
            <div className="mt-4 flex flex-wrap gap-2">
               {brand.targets?.map((t: any) => (
                 <span key={t.username} className="bg-white/5 py-1 px-3 rounded-full text-[10px] flex items-center gap-1 border border-white/10 group-hover:border-primary/20">
                    @{t.username}
                 </span>
               ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
