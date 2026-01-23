import { useEffect, useState, useCallback } from 'react';

interface EmbeddedSignupData {
  phone_number_id?: string;
  waba_id?: string;
}

/**
 * Hook to interact with the Facebook JavaScript SDK.
 * Ensures the SDK is initialized before use.
 */
export const useFacebook = (appId?: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<EmbeddedSignupData | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If no appId yet, we can't initialize but we should still load the SDK
    if (!appId) {
      console.log('[useFacebook] Waiting for appId...');
      return;
    }

    console.log('[useFacebook] Initializing with appId:', appId);

    // Initialize the SDK if it's available
    const initFB = () => {
      if (window.FB) {
        console.log('[useFacebook] FB SDK found, initializing...');
        window.FB.init({
          appId: appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v22.0',
        });
        setIsLoaded(true);
        console.log('[useFacebook] FB SDK initialized successfully (v22.0)');
      }
    };

    if (window.FB) {
      initFB();
    } else {
      console.log('[useFacebook] FB SDK not loaded yet, polling...');
      const interval = setInterval(() => {
        if (window.FB) {
          initFB();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [appId]);

  // Listen for messages from the Facebook popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // DEBUG: Log everything to catch Meta's communication
      console.log('[useFacebook] Received window message:', {
        origin: event.origin,
        data: event.data,
      });

      // Allow all variations of facebook origins
      const allowedOrigins = [
        'https://www.facebook.com',
        'https://web.facebook.com',
        'https://business.facebook.com',
        'https://facebook.com',
      ];

      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH') {
            const { phone_number_id, waba_id } = data.data;
            console.log('WA Embedded Signup FINISH:', { phone_number_id, waba_id });
            setSessionInfo({ phone_number_id, waba_id });
          } else if (data.event === 'CANCEL') {
            console.warn('WA Embedded Signup CANCEL at step:', data.data?.current_step);
          } else if (data.event === 'ERROR') {
            console.error('WA Embedded Signup ERROR:', data.data?.error_message);
          }
        }
      } catch (err) {
        // Not a JSON message or unrelated to us
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /**
   * Triggers the Facebook Login dialog for WhatsApp Embedded Signup.
   * @param callback Function to handle the response from Meta.
   */
  const launchEmbeddedSignup = useCallback(
    (callback: (response: facebook.StatusResponse) => void) => {
      if (!window.FB) {
        console.error('Facebook SDK not loaded yet.');
        return;
      }

      console.log(
        '[useFacebook] Launching Embedded Signup with config_id:',
        import.meta.env.VITE_FB_CONFIG_ID
      );

      window.FB.login(callback, {
        config_id: import.meta.env.VITE_FB_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      });
    },
    []
  );

  return {
    isLoaded,
    sessionInfo,
    launchEmbeddedSignup,
  };
};
