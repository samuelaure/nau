import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { checkSession, type SessionUser } from '../lib/auth';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionUser | null | 'loading'>('loading');

  useEffect(() => {
    checkSession().then(setSession);
  }, []);

  if (session === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary, #888)' }}>Cargando…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
