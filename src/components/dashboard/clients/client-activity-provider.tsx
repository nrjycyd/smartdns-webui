'use client';

import * as React from 'react';
import { CLIENT_REFRESH_INTERVAL } from './client-activity';

const ClientActivityContext = React.createContext({ now: 0, available: false, observedAt: 0 });

export function ClientActivityProvider({ available, observedAt = 0, children }: { available: boolean; observedAt?: number; children: React.ReactNode }): React.JSX.Element {
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    let timer: number | undefined;
    const tick = () => { setNow(Date.now()); };
    const update = () => {
      if (document.hidden) { window.clearInterval(timer); timer = undefined; }
      else if (timer === undefined) { tick(); timer = window.setInterval(tick, CLIENT_REFRESH_INTERVAL); }
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  const value = React.useMemo(() => ({ now, available, observedAt }), [now, available, observedAt]);
  return <ClientActivityContext.Provider value={value}>{children}</ClientActivityContext.Provider>;
}

export function useClientActivityClock(): { now: number; available: boolean; observedAt: number } {
  return React.useContext(ClientActivityContext);
}
