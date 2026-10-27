'use client';

import * as React from 'react';
import { DEFAULT_TIME_SETTINGS, TIME_SETTINGS_KEY, formatDisplayTime, parseTimeSettings, validTimeZone, type TimeSettings } from '@/lib/display-time';

const TimeDisplayContext = React.createContext({
  ...DEFAULT_TIME_SETTINGS, ready: false, storageError: false,
  save: (_value: TimeSettings): void => {},
});

export function TimeDisplayProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [settings, setSettings] = React.useState(DEFAULT_TIME_SETTINGS);
  const [ready, setReady] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);
  React.useEffect(() => {
    const read = () => {
      try { setSettings(parseTimeSettings(localStorage.getItem(TIME_SETTINGS_KEY))); setStorageError(false); }
      catch { setStorageError(true); }
      setReady(true);
    };
    read();
    const onStorage = (event: StorageEvent) => { if (event.key === TIME_SETTINGS_KEY || event.key === null) read(); };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, []);
  const save = React.useCallback((value: TimeSettings) => {
    if (!validTimeZone(value.timeZone) || !validTimeZone(value.statisticsTimeZone)) return;
    try { localStorage.setItem(TIME_SETTINGS_KEY, JSON.stringify(value)); setSettings(value); setStorageError(false); }
    catch { setStorageError(true); }
  }, []);
  const value = React.useMemo(() => ({ ...settings, ready, storageError, save }), [settings, ready, storageError, save]);
  return <TimeDisplayContext.Provider value={value}>{children}</TimeDisplayContext.Provider>;
}

export function useTimeDisplay() {
  const settings = React.useContext(TimeDisplayContext);
  const formatTime = React.useCallback((value: number | string | Date, format?: string) => formatDisplayTime(value, settings.timeZone, format), [settings.timeZone]);
  return { ...settings, formatTime };
}
