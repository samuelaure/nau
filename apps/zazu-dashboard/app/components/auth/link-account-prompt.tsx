'use client';

import { useState } from 'react';
import { LinkIcon, Loader2, ShieldCheck } from 'lucide-react';
import { linkTelegramAccount } from '../../lib/link-account';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://zazu.9nau.com';

export default function LinkAccountPrompt() {
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLink = () => {
    let initData: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const WebApp = require('@twa-dev/sdk').default;
      initData = WebApp.initData || undefined;
    } catch { /* not in Mini App context */ }

    // Embed initData in the callback URL so it survives cross-domain redirects
    // (Telegram may open the accounts service in an external browser, losing
    // the Mini App WebView context and its session cookie on the way back).
    const callbackUrl = new URL(`${DASHBOARD_URL}/auth/link-callback`);
    if (initData) callbackUrl.searchParams.set('initData', initData);
    window.location.href = `${ACCOUNTS_URL}/login?continue=${encodeURIComponent(callbackUrl.toString())}`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="glass-card" style={{
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
      }}>
        <div style={{
          background: 'rgba(0, 255, 136, 0.1)',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          border: '1px solid var(--primary)',
        }}>
          <LinkIcon size={28} color="var(--primary)" />
        </div>

        <h2 className="glow-text" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>
          Vincula tu cuenta naŭ
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '28px', lineHeight: 1.5 }}>
          Para acceder a todas las funciones de la plataforma, vincula tu identidad de Telegram con tu cuenta global naŭ. Solo necesitas hacerlo una vez.
        </p>

        {error && (
          <p style={{ color: '#ff4444', fontSize: '0.8rem', marginBottom: '16px' }}>{error}</p>
        )}

        <button
          onClick={handleLink}
          disabled={linking}
          className="btn-primary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {linking ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ShieldCheck size={16} />
          )}
          Iniciar sesión con naŭ
        </button>
      </div>
    </div>
  );
}
