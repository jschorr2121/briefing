'use client';

import { ReactNode, useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from './Toast';
import { initNativePlugins } from '@/lib/capacitor';

export function Providers({ children }: { children: ReactNode }) {
  // Initialize Capacitor native plugins on mount (no-op on web)
  useEffect(() => {
    initNativePlugins();
  }, []);

  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
