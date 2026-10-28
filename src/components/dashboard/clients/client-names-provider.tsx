'use client';

import * as React from 'react';
import { CLIENT_NAMES_STORAGE_KEY, parseClientNames, parseClientIcons, serializeClientNames, updateClientName, updateClientIcon, type ClientNames } from './client-names';

interface ClientNamesContextValue {
  names: ClientNames;
  icons: ClientNames;
  ready: boolean;
  storageError: boolean;
  saveName: (mac: string, name: string) => boolean;
  saveAppearance: (mac: string, name: string, icon: string | undefined) => boolean;
}

const ClientNamesContext = React.createContext<ClientNamesContextValue>({ names: {}, icons: {}, ready: false, storageError: false, saveName: () => false, saveAppearance: () => false });

export function ClientNamesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [names, setNames] = React.useState<ClientNames>({});
  const [icons, setIcons] = React.useState<ClientNames>({});
  const [ready, setReady] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);

  React.useEffect(() => {
    function readNames() {
      try {
        const source = window.localStorage.getItem(CLIENT_NAMES_STORAGE_KEY);
        const nextNames = parseClientNames(source);
        const nextIcons = parseClientIcons(source);
        setNames(nextNames);
        setIcons(nextIcons);
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

  const save = React.useCallback((mac: string, name: string, icon?: { value: string | undefined }) => {
    try {
      // Merge into the latest stored map so edits in another tab are retained.
      const source = window.localStorage.getItem(CLIENT_NAMES_STORAGE_KEY);
      const latest = parseClientNames(source);
      const latestIcons = parseClientIcons(source);
      const next = updateClientName(latest, mac, name);
      const nextIcons = icon ? updateClientIcon(latestIcons, mac, icon.value) : latestIcons;
      // One write commits the label and icon together, retaining the v1 names map.
      window.localStorage.setItem(CLIENT_NAMES_STORAGE_KEY, serializeClientNames(next, nextIcons));
      setNames(next);
      setIcons(nextIcons);
      setStorageError(false);
      return true;
    } catch {
      setStorageError(true);
      return false;
    }
  }, []);

  const saveName = React.useCallback((mac: string, name: string) => save(mac, name), [save]);
  const saveAppearance = React.useCallback((mac: string, name: string, icon: string | undefined) => save(mac, name, { value: icon }), [save]);
  const value = React.useMemo(() => ({ names, icons, ready, storageError, saveName, saveAppearance }), [names, icons, ready, storageError, saveName, saveAppearance]);
  return <ClientNamesContext.Provider value={value}>{children}</ClientNamesContext.Provider>;
}

export function useClientNames(): ClientNamesContextValue {
  return React.useContext(ClientNamesContext);
}
