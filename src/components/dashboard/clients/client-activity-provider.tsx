'use client';

import * as React from 'react';
import { CLIENT_REFRESH_INTERVAL } from './client-activity';

const ClientActivityContext = React.createContext({ now: 0, available: false, observedAt: 0 });

export function ClientActivityProvider({ available, observedAt = 0, children }: { available: boolean; observedAt?: number; children: React.ReactNode }): React.JSX.Element {
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    const tick = () => { setNow(Date.now()); };
    tick();
    const timer = window.setInterval(tick, CLIENT_REFRESH_INTERVAL);
    // Refresh the clock immediately when returning to a backgrounded tab.
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  const value = React.useMemo(() => ({ now, available, observedAt }), [now, available, observedAt]);
  return <ClientActivityContext.Provider value={value}>{children}</ClientActivityContext.Provider>;
}

export function useClientActivityClock(): { now: number; available: boolean; observedAt: number } {
  return React.useContext(ClientActivityContext);
}
