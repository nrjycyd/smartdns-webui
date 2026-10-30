'use client';

import * as React from 'react';

const TableTouchContext = React.createContext<boolean | undefined>(undefined);

// Share one live capability query across a table's cells. A mode change still
// reaches every cell, including the original touch-only tooltip/copy fallback.
export function TableInputMode({ children }: { children: React.ReactNode }): React.JSX.Element {
  const media = React.useMemo(() => typeof window === 'undefined' ? null : window.matchMedia('(hover: none)'), []);
  const subscribe = React.useCallback((notify: () => void) => {
    media?.addEventListener('change', notify);
    return () => { media?.removeEventListener('change', notify); };
  }, [media]);
  const snapshot = React.useCallback(() => media?.matches ?? false, [media]);
  const touchOnly = React.useSyncExternalStore(subscribe, snapshot, () => false);
  return <TableTouchContext.Provider value={touchOnly}>{children}</TableTouchContext.Provider>;
}

export function useTableTouchOnly(): boolean | undefined {
  return React.useContext(TableTouchContext);
}
