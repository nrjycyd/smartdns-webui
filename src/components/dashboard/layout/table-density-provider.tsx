'use client';

import * as React from 'react';

export type TableDensity = 'compact' | 'comfortable' | 'spacious';
export const TABLE_DENSITY_STORAGE_KEY = 'smartdns-webui:table-density:v1';

interface TableDensityContextValue {
  density: TableDensity;
  ready: boolean;
  storageError: boolean;
  saveDensity: (density: TableDensity) => void;
}

const TableDensityContext = React.createContext<TableDensityContextValue>({ density: 'comfortable', ready: false, storageError: false, saveDensity: () => {} });

export function TableDensityProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [density, setDensity] = React.useState<TableDensity>('comfortable');
  const [ready, setReady] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);

  React.useEffect(() => {
    function readDensity() {
      try {
        const stored = window.localStorage.getItem(TABLE_DENSITY_STORAGE_KEY);
        setDensity(stored === 'compact' || stored === 'spacious' ? stored : 'comfortable');
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
      setReady(true);
    }
    readDensity();
    const onStorage = (event: StorageEvent) => {
      if (event.key === TABLE_DENSITY_STORAGE_KEY || event.key === null) readDensity();
    };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, []);

  const saveDensity = React.useCallback((next: TableDensity) => {
    try {
      window.localStorage.setItem(TABLE_DENSITY_STORAGE_KEY, next);
      setDensity(next);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, []);

  const value = React.useMemo(() => ({ density, ready, storageError, saveDensity }), [density, ready, storageError, saveDensity]);
  return <TableDensityContext.Provider value={value}>{children}</TableDensityContext.Provider>;
}

export function useTableDensity(): TableDensityContextValue {
  return React.useContext(TableDensityContext);
}

export function useTableDensityPreview(): readonly [TableDensity, React.Dispatch<React.SetStateAction<TableDensity>>] {
  const { density: globalDensity } = useTableDensity();
  const [preview, setPreview] = React.useState({ base: globalDensity, value: globalDensity });

  // A new global preference replaces this page's temporary preview.
  if (preview.base !== globalDensity) setPreview({ base: globalDensity, value: globalDensity });

  const setDensity = React.useCallback((next: React.SetStateAction<TableDensity>) => {
    setPreview((previous) => ({
      base: globalDensity,
      value: typeof next === 'function' ? next(previous.base === globalDensity ? previous.value : globalDensity) : next,
    }));
  }, [globalDensity]);

  return [preview.base === globalDensity ? preview.value : globalDensity, setDensity];
}
