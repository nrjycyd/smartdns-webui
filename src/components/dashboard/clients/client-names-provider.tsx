'use client';

import * as React from 'react';
import { CLIENT_NAMES_STORAGE_KEY, parseClientNames, parseClientIcons, parseClientIconColors, serializeClientNames, updateClientName, updateClientIcon, updateClientIconColor, type ClientNames } from './client-names';

interface ClientNamesContextValue {
  names: ClientNames;
  icons: ClientNames;
  iconColors: ClientNames;
  ready: boolean;
  storageError: boolean;
  saveName: (mac: string, name: string) => boolean;
  saveAppearance: (mac: string, name: string, icon: string | undefined, color: string | undefined) => boolean;
}

const ClientNamesContext = React.createContext<ClientNamesContextValue>({ names: {}, icons: {}, iconColors: {}, ready: false, storageError: false, saveName: () => false, saveAppearance: () => false });

export function ClientNamesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [names, setNames] = React.useState<ClientNames>({});
  const [icons, setIcons] = React.useState<ClientNames>({});
  const [iconColors, setIconColors] = React.useState<ClientNames>({});
  const [ready, setReady] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);

  React.useEffect(() => {
    function readNames() {
      try {
        const source = window.localStorage.getItem(CLIENT_NAMES_STORAGE_KEY);
        const nextNames = parseClientNames(source);
        const nextIcons = parseClientIcons(source);
        const nextColors = parseClientIconColors(source);
        setNames(nextNames);
        setIcons(nextIcons);
        setIconColors(nextColors);
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

  const save = React.useCallback((mac: string, name: string, appearance?: { icon: string | undefined; color: string | undefined }) => {
    try {
      // Merge into the latest stored map so edits in another tab are retained.
      const source = window.localStorage.getItem(CLIENT_NAMES_STORAGE_KEY);
      const latest = parseClientNames(source);
      const latestIcons = parseClientIcons(source);
      const latestColors = parseClientIconColors(source);
      const next = updateClientName(latest, mac, name);
      const nextIcons = appearance ? updateClientIcon(latestIcons, mac, appearance.icon) : latestIcons;
      const nextColors = appearance ? updateClientIconColor(latestColors, mac, appearance.color) : latestColors;
      // One write commits the label, icon and color together, retaining v1 compatibility.
      window.localStorage.setItem(CLIENT_NAMES_STORAGE_KEY, serializeClientNames(next, nextIcons, nextColors));
      setNames(next);
      setIcons(nextIcons);
      setIconColors(nextColors);
      setStorageError(false);
      return true;
    } catch {
      setStorageError(true);
      return false;
    }
  }, []);

  const saveName = React.useCallback((mac: string, name: string) => save(mac, name), [save]);
  const saveAppearance = React.useCallback((mac: string, name: string, icon: string | undefined, color: string | undefined) => save(mac, name, { icon, color }), [save]);
  const value = React.useMemo(() => ({ names, icons, iconColors, ready, storageError, saveName, saveAppearance }), [names, icons, iconColors, ready, storageError, saveName, saveAppearance]);
  return <ClientNamesContext.Provider value={value}>{children}</ClientNamesContext.Provider>;
}

export function useClientNames(): ClientNamesContextValue {
  return React.useContext(ClientNamesContext);
}
