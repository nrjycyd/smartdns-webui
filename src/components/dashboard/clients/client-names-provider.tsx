'use client';

import * as React from 'react';
import { CLIENT_NAMES_STORAGE_KEY, parseClientNames, serializeClientNames, updateClientName, type ClientNames } from './client-names';

interface ClientNamesContextValue {
  names: ClientNames;
  ready: boolean;
  storageError: boolean;
  saveName: (mac: string, name: string) => boolean;
}

const ClientNamesContext = React.createContext<ClientNamesContextValue>({ names: {}, ready: false, storageError: false, saveName: () => false });

export function ClientNamesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [names, setNames] = React.useState<ClientNames>({});
  const [ready, setReady] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);

  React.useEffect(() => {
    function readNames() {
      try {
        setNames(parseClientNames(window.localStorage.getItem(CLIENT_NAMES_STORAGE_KEY)));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
      setReady(true);
    }
    readNames();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CLIENT_NAMES_STORAGE_KEY || event.key === null) readNames();
    };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, []);

  const saveName = React.useCallback((mac: string, name: string) => {
    try {
      // Merge into the latest stored map so edits in another tab are retained.
      const latest = parseClientNames(window.localStorage.getItem(CLIENT_NAMES_STORAGE_KEY));
      const next = updateClientName(latest, mac, name);
      window.localStorage.setItem(CLIENT_NAMES_STORAGE_KEY, serializeClientNames(next));
      setNames(next);
      setStorageError(false);
      return true;
    } catch {
      setStorageError(true);
      return false;
    }
  }, []);

  const value = React.useMemo(() => ({ names, ready, storageError, saveName }), [names, ready, storageError, saveName]);
  return <ClientNamesContext.Provider value={value}>{children}</ClientNamesContext.Provider>;
}

export function useClientNames(): ClientNamesContextValue {
  return React.useContext(ClientNamesContext);
}
