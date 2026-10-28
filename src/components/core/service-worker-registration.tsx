'use client';

import * as React from 'react';

export function ServiceWorkerRegistration(): null {
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production' && window.isSecureContext && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error_: unknown) => {
        console.warn('SmartDNS service worker registration failed:', error_);
      });
    }
  }, []);
  return null;
}
