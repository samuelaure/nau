'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { linkTelegramAccount } from '../../lib/link-account';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

function LinkCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'linking' | 'success' | 'error'>('linking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/');
      return;
    }

    // Resolve initData in priority order:
    // 1. URL param (embedded by link-account-prompt before the cross-domain redirect)
    // 2. Live SDK value (works when the callback stays in the Mini App WebView)
    let initData: string | undefined;
    initData = searchParams.get('initData') || undefined;
    if (!initData) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const WebApp = require('@twa-dev/sdk').default;
        initData = WebApp.initData || undefined;
      } catch { /* not in Mini App context */ }
    }

    linkTelegramAccount(token, initData).then(async (result) => {
      if (result.success) {
        setStatus('success');
        // Discard the stale JWT (nauUserId: null) and force a fresh Telegram login.
        // The /login page auto-signs in via WebApp.initData, and the new session
        // will have nauUserId populated from the DB.
        await signOut({ redirect: false });
        router.replace('/login');
      } else {
        setStatus('error');
        setErrorMsg(result.error ?? 'Error desconocido');
        setTimeout(() => router.replace('/'), 3000);
      }
    });
  }, [searchParams, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      {status === 'linking' && (
        <>
          <Loader2 className="animate-spin" size={40} color="var(--primary)" />
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Vinculando tu cuenta naŭ…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle size={40} color="var(--primary)" />
          <p style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 600 }}>¡Cuenta vinculada! Iniciando sesión…</p>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle size={40} color="#ff4444" />
          <p style={{ color: '#ff4444', fontSize: '0.9rem' }}>Error al vincular: {errorMsg}</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Redirigiendo…</p>
        </>
      )}
    </div>
  );
}

export default function LinkCallbackPage() {
  return (
    <Suspense>
      <LinkCallbackHandler />
    </Suspense>
  );
}
