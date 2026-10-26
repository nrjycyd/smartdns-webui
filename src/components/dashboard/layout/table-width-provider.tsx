'use client';

import * as React from 'react';

export type TableWidthMode = 'auto' | 'manual';
export const TABLE_WIDTH_STORAGE_KEY = 'smartdns-webui:column-width-mode:v1';
const TableWidthContext = React.createContext<{ mode: TableWidthMode; ready: boolean; storageError: boolean; saveMode: (mode: TableWidthMode) => void }>({ mode: 'auto', ready: false, storageError: false, saveMode: () => {} });

export function TableWidthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [mode, setMode] = React.useState<TableWidthMode>('auto');
  const [ready, setReady] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);
  React.useEffect(() => {
    function read() {
      try {
        setMode(window.localStorage.getItem(TABLE_WIDTH_STORAGE_KEY) === 'manual' ? 'manual' : 'auto');
        setStorageError(false);
      } catch { setStorageError(true); }
      setReady(true);
    }
    read();
    const onStorage = (event: StorageEvent) => { if (event.key === TABLE_WIDTH_STORAGE_KEY || event.key === null) read(); };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, []);
  const saveMode = React.useCallback((next: TableWidthMode) => {
    try {
      window.localStorage.setItem(TABLE_WIDTH_STORAGE_KEY, next);
      setMode(next);
      setStorageError(false);
    } catch { setStorageError(true); }
  }, []);
  const value = React.useMemo(() => ({ mode, ready, storageError, saveMode }), [mode, ready, storageError, saveMode]);
  return <TableWidthContext.Provider value={value}>{children}</TableWidthContext.Provider>;
}

export function useTableWidth(): React.ContextType<typeof TableWidthContext> {
  return React.useContext(TableWidthContext);
}
