'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface TelegramContextType {
  user: any;
  initData: string;
  isReady: boolean;
}

const TelegramContext = createContext<TelegramContextType | null>(null);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [initData, setInitData] = useState<string>('');

  useEffect(() => {
    // Notify Telegram that the Mini App is ready
    if (typeof window !== 'undefined') {
      const WebApp = require('@twa-dev/sdk').default;
      WebApp.ready();
      WebApp.expand();
      document.documentElement.className = WebApp.colorScheme;
      
      setUser(WebApp.initDataUnsafe?.user || null);
      setInitData(WebApp.initData || '');
      setIsReady(true);
    }
  }, []);

  const value = {
    user,
    initData,
    isReady
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

export const useTelegram = () => {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegram must be used within a TelegramProvider');
  }
  return context;
};
