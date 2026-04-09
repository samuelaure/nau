'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Terminal, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    // 1. Check if we have a session already
    if (session) {
      router.push('/');
      return;
    }

    // 2. Try Telegram Auto-Login
    const attemptTelegramLogin = async () => {
      // Small delay to ensure WebApp is injected
      await new Promise(r => setTimeout(r, 500));
      
      if (typeof window !== 'undefined') {
        const WebApp = require('@twa-dev/sdk').default;
        const initData = WebApp.initData;

        if (initData) {
          console.log('Zazŭ: Attempting Telegram auto-login...');
          setAutoLoggingIn(true);
          try {
            const result = await signIn('telegram-login', {
              initData,
              redirect: false,
            });

            if (result?.ok) {
              console.log('Zazŭ: Telegram auth successful.');
              router.push('/');
              router.refresh();
            } else {
              console.warn('Zazŭ: Telegram auth failed, falling back to password.');
              setAutoLoggingIn(false);
            }
          } catch (err) {
            console.error('Zazŭ: Auto-login exception', err);
            setAutoLoggingIn(false);
          }
        }
      }
    };

    attemptTelegramLogin();
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Acceso denegado. Llave de seguridad incorrecta.');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError('Error inesperado. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '30px' }}>
          <div style={{
            background: 'rgba(0, 255, 136, 0.1)',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            border: '1px solid var(--primary)'
          }}>
            <ShieldCheck size={32} color="var(--primary)" />
          </div>
          <h1 className="glow-text" style={{ fontSize: '2rem', fontWeight: 800 }}>ZAZŬ</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>CENTRO DE MANDO ESTRATÉGICO</p>
        </div>

        {autoLoggingIn ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '20px', paddingBottom: '20px' }}>
            <Loader2 className="animate-spin" size={32} color="var(--primary)" />
            <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>Iniciando sesión segura via Telegram...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                LLAVE DE SEGURIDAD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              </div>
            </div>

            {error && <p style={{ color: '#ff4444', fontSize: '0.8rem', fontWeight: 600 }}>{error}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '10px' }}
            >
              {loading ? 'AUTENTICANDO...' : 'ACCEDER AL NÚCLEO'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
            <Terminal size={14} />
            <span>Zazu Engine v1.2.0-secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
