import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkSession, redirectToLogin } from '../lib/auth';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    checkSession().then((session) => {
      if (session) {
        navigate('/', { replace: true });
      } else {
        redirectToLogin();
      }
    });
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p style={{ color: 'var(--text-secondary, #888)' }}>Iniciando sesión…</p>
    </div>
  );
}
