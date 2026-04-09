'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TelegramProvider, useTelegram } from '../components/TelegramProvider';
import { Save, Sparkles, ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';

function EditSuggestionContent() {
  const searchParams = useSearchParams();
  const { isReady, user } = useTelegram();
  const [suggestion, setSuggestion] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const brandId = searchParams.get('brandId');
  const postId = searchParams.get('postId');
  const index = searchParams.get('suggestionIndex');

  useEffect(() => {
    setSuggestion("Cargando sugerencia...");
    setTimeout(() => {
        setSuggestion("¡Excelente post! Me encanta cómo manejas la iluminación aquí. 📸✨");
    }, 800);
  }, [brandId, postId, index]);

  const handleSave = async () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  if (!isReady) return <div className="min-h-screen flex items-center justify-center bg-bg-dark"><Sparkles className="animate-pulse text-primary" size={48} /></div>;

  return (
    <div className="p-6 max-w-2xl mx-auto w-full">
      <header className="mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-primary no-underline text-xs font-bold uppercase tracking-widest mb-4">
          <ArrowLeft size={14} /> Volver
        </Link>
        <h1 className="text-3xl font-extrabold text-text mb-2">Editar Sugerencia</h1>
        <p className="text-text-dim text-sm">Refina el comentario para un impacto máximo.</p>
      </header>

      <div className="glass-card p-6 border-primary/30">
        <label className="block text-[10px] uppercase font-bold text-text-dim tracking-wider mb-2">Comentario de la IA</label>
        <textarea 
          className="input-field min-h-[150px] text-lg leading-relaxed"
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
        />
        
        <div className="mt-6 flex flex-col gap-4">
          <button 
            onClick={handleSave}
            className="btn-primary flex items-center justify-center gap-2 py-4"
          >
            {isSaved ? <><Check size={20} /> Guardado</> : <><Save size={20} /> Guardar Cambios</>}
          </button>
          
          <p className="text-[10px] text-text-dim text-center italic">
            Al guardar, Zazŭ aprenderá de tus preferencias para futuras sugerencias.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function EditSuggestionPage() {
  return (
    <main className="min-h-screen bg-bg-dark">
      <TelegramProvider>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-bg-dark"><Sparkles className="animate-pulse text-primary" size={48} /></div>}>
          <EditSuggestionContent />
        </Suspense>
      </TelegramProvider>
    </main>
  );
}
