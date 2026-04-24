'use client';

import { useState, useEffect } from 'react';
import { LinkIcon, Loader2, ShieldCheck, MessageCircle, RefreshCw } from 'lucide-react';
import { useSession } from 'next-auth/react';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://zazu.9nau.com';

export default function LinkAccountPrompt() {
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [linking, setLinking] = useState(false);
  const [checking, setChecking] = useState(false);
  const { update } = useSession();

  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const WebApp = require('@twa-dev/sdk').default;
      if (WebApp.initData) {
        setIsMiniApp(true);
      }
    } catch {
      setIsMiniApp(false);
    }
  }, []);

  const handleLink = () => {
    setLinking(true);
    let initData: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const WebApp = require('@twa-dev/sdk').default;
      initData = WebApp.initData || undefined;
    } catch { /* ignore */ }

    const callbackUrl = new URL(`${DASHBOARD_URL}/auth/link-callback`);
    if (initData) callbackUrl.searchParams.set('initData', initData);
    window.location.href = `${ACCOUNTS_URL}/login?continue=${encodeURIComponent(callbackUrl.toString())}`;
  };

  const handleRefresh = async () => {
    setChecking(true);
    await update();
    setChecking(false);
  };

  return (
    <div style={{
      background: 'rgba(0, 255, 136, 0.05)',
      borderBottom: '1px solid var(--primary)',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ 
          background: 'rgba(0, 255, 136, 0.1)', 
          padding: '6px', 
          borderRadius: '50%', 
          display: 'flex' 
        }}>
          <LinkIcon size={16} color="var(--primary)" />
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500 }}>
          {isMiniApp 
            ? 'Vincula tu cuenta naŭ para habilitar todas las funciones.' 
            : 'Tu cuenta de Telegram no está vinculada aún.'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {isMiniApp ? (
          <button
            onClick={handleLink}
            disabled={linking}
            className="btn-primary"
            style={{ 
              padding: '6px 16px', 
              fontSize: '0.8rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}
          >
            {linking ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Vincular ahora
          </button>
        ) : (
          <>
            <a
              href="https://t.me/zazu_9nau_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ 
                padding: '6px 16px', 
                fontSize: '0.8rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                textDecoration: 'none'
              }}
            >
              <MessageCircle size={14} />
              Abrir en Telegram
            </a>
            <button
              onClick={handleRefresh}
              disabled={checking}
              style={{ 
                background: 'transparent',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-dim)',
                padding: '6px 16px', 
                fontSize: '0.8rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              Verificar vinculación
            </button>
          </>
        )}
      </div>
    </div>
  );
}
