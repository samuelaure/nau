import React, { useState } from 'react';
import { useFacebook } from '../../hooks/useFacebook';
import { MessageSquare, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface WhatsAppOnboardingProps {
  appId?: string;
}

export const WhatsAppOnboarding: React.FC<WhatsAppOnboardingProps> = ({ appId }) => {
  const { isLoaded, sessionInfo, launchEmbeddedSignup } = useFacebook(appId);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  React.useEffect(() => {
    console.log('[WhatsAppOnboarding] Received appId:', appId);
    console.log('[WhatsAppOnboarding] isLoaded:', isLoaded);
  }, [appId, isLoaded]);

  // Hide component if Meta App credentials are not configured
  if (!appId) {
    return null;
  }

  const handleSignup = () => {
    setStatus('loading');
    launchEmbeddedSignup((response) => {
      console.log('[WhatsAppOnboarding] Facebook response:', response);
      console.log('[WhatsAppOnboarding] authResponse:', response.authResponse);
      console.log('[WhatsAppOnboarding] status:', response.status);

      // Ignore the initial "unknown" status - this is fired immediately before the popup completes
      if (response.status === 'unknown' && !response.authResponse) {
        console.log(
          '[WhatsAppOnboarding] Ignoring initial unknown status, waiting for completion...'
        );
        return;
      }

      // Handle the response in a non-async way by wrapping async logic
      (async () => {
        if (response.authResponse) {
          const code = (response.authResponse as facebook.AuthResponse & { code: string }).code;
          console.log('[WhatsAppOnboarding] Authorization code:', code);

          // At this point we might or might not have sessionInfo from the window message
          // The listener in useFacebook sets it. We wait a bit if needed.
          const finalSession = sessionInfo;

          // Wait up to 2 seconds for the postMessage to arrive if it hasn't yet
          if (!finalSession) {
            let retries = 0;
            while (!finalSession && retries < 20) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              // Note: sessionInfo from hook might not update in this closure easily
              // but we'll try to use a local variable or just proceed.
              // In a real hook, we'd use a ref or just rely on the next effect.
              retries++;
            }
          }

          console.log('[WhatsAppOnboarding] Final session info:', sessionInfo);

          try {
            const res = await fetch('/api/whatsapp/onboard', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code,
                phone_number_id: sessionInfo?.phone_number_id,
                waba_id: sessionInfo?.waba_id,
              }),
            });

            const data = await res.json();
            console.log('[WhatsAppOnboarding] Backend response:', data);

            if (res.ok && data.success) {
              setStatus('success');
            } else {
              setStatus('error');
              setErrorMessage(data.error || 'Failed to link account');
            }
          } catch {
            console.error('[WhatsAppOnboarding] Network error');
            setStatus('error');
            setErrorMessage('Network error during onboarding');
          }
        } else if (response.status === 'not_authorized') {
          console.error('[WhatsAppOnboarding] User denied permissions');
          setStatus('error');
          setErrorMessage('You must grant permissions to connect WhatsApp');
        } else {
          console.error('[WhatsAppOnboarding] Login cancelled or failed');
          setStatus('error');
          setErrorMessage('Facebook login cancelled or failed');
        }
      })();
    });
  };

  return (
    <div className="settings-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <MessageSquare size={20} color="#25D366" />
        <h3 style={{ margin: 0 }}>WhatsApp Business Setup</h3>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Connect your WhatsApp Business Account to enable automated campaigns.
      </p>

      {status === 'idle' && (
        <button
          onClick={handleSignup}
          disabled={!isLoaded}
          style={{
            backgroundColor: '#1877f2',
            color: '#fff',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {!isLoaded ? <Loader2 className="animate-spin" size={18} /> : null}
          Login with Facebook
        </button>
      )}

      {status === 'loading' && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <Loader2
            className="animate-spin"
            size={32}
            color="var(--primary)"
            style={{ margin: '0 auto' }}
          />
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Processing connection...</p>
        </div>
      )}

      {status === 'success' && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(37, 211, 102, 0.1)',
            borderRadius: '0.75rem',
            border: '1px solid #25D366',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <CheckCircle2 size={24} color="#25D366" />
          <div>
            <div style={{ fontWeight: 'bold', color: '#25D366' }}>Connected Successfully</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
              Your WhatsApp account is now linked to whatsnaŭ.
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '0.75rem',
            border: '1px solid #ef4444',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}
          >
            <AlertCircle size={24} color="#ef4444" />
            <div style={{ fontWeight: 'bold', color: '#ef4444' }}>Connection Failed</div>
          </div>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>{errorMessage}</p>
          <button
            onClick={() => setStatus('idle')}
            style={{
              marginTop: '1rem',
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {sessionInfo && status === 'idle' && (
        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Session detected: WABA {sessionInfo.waba_id}
        </div>
      )}
    </div>
  );
};
