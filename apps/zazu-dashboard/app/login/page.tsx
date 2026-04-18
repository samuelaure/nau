'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShieldCheck, Terminal, Loader2 } from 'lucide-react';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://zazu.9nau.com';

export default function LoginPage() {
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      router.push('/');
      return;
    }

    const attemptTelegramLogin = async () => {
      await new Promise(r => setTimeout(r, 500));

      if (typeof window !== 'undefined') {
        const WebApp = require('@twa-dev/sdk').default;
        const initData = WebApp.initData;

        if (initData) {
          setAutoLoggingIn(true);
          try {
            const result = await signIn('telegram-login', { initData, redirect: false });
            if (result?.ok) {
              router.push('/');
              router.refresh();
            } else {
              setAutoLoggingIn(false);
            }
          } catch {
            setAutoLoggingIn(false);
          }
        }
      }
    };

    attemptTelegramLogin();
  }, [session, router]);

  const handleNauLogin = () => {
    const callbackUrl = `${DASHBOARD_URL}/auth/callback`;
    window.location.href = `${ACCOUNTS_URL}/login?continue=${encodeURIComponent(callbackUrl)}`;
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Accede con tu cuenta naŭ para continuar.
            </p>
            <button
              onClick={handleNauLogin}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Iniciar sesión con naŭ
            </button>
          </div>
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
