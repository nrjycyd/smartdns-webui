'use client';

import * as React from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaContextValue {
  canInstall: boolean;
  installed: boolean;
  secure: boolean;
  pending: boolean;
  error: boolean;
  install: () => Promise<void>;
}

const PwaContext = React.createContext<PwaContextValue | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [prompt, setPrompt] = React.useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [secure, setSecure] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const updateDisplayMode = (): void => {
      const iosNavigator = navigator as Navigator & { standalone?: boolean };
      setInstalled(displayMode.matches || iosNavigator.standalone === true);
    };
    const onPrompt = (event: Event): void => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
      setError(false);
    };
    const onInstalled = (): void => {
      setInstalled(true);
      setPrompt(null);
      setError(false);
    };

    setSecure(window.isSecureContext);
    updateDisplayMode();
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', updateDisplayMode);

    if (process.env.NODE_ENV === 'production' && window.isSecureContext && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error_: unknown) => {
        console.warn('SmartDNS service worker registration failed:', error_);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', updateDisplayMode);
    };
  }, []);

  const install = async (): Promise<void> => {
    if (!prompt || pending) return;
    setPending(true);
    setError(false);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setError(true);
    } finally {
      // Each browser prompt can only be used once, including after dismissal.
      setPrompt(null);
      setPending(false);
    }
  };

  return (
    <PwaContext.Provider value={{ canInstall: prompt !== null, installed, secure, pending, error, install }}>
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa(): PwaContextValue {
  const context = React.useContext(PwaContext);
  if (!context) throw new Error('usePwa must be used within PwaProvider');
  return context;
}
