'use client';

import * as React from 'react';
import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { DEFAULT_TIME_SETTINGS, TIME_SETTINGS_KEY, ensureTimeZoneRules, timeZoneRulesReady, formatDisplayTime, parseTimeSettings, validTimeZone, type TimeSettings } from '@/lib/display-time';

const TimeDisplayContext = React.createContext({
  ...DEFAULT_TIME_SETTINGS, ready: false, storageError: false,
  save: (_value: TimeSettings): void => {},
});

export function TimeDisplayProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [settings, setSettings] = React.useState(DEFAULT_TIME_SETTINGS);
  const [ready, setReady] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);
  const [loadingRules, setLoadingRules] = React.useState(false);
  const [rulesError, setRulesError] = React.useState(false);
  const generation = React.useRef(0);
  const pending = React.useRef(DEFAULT_TIME_SETTINGS);
  const { t } = useTranslation();
  const apply = React.useCallback((next: TimeSettings) => {
    pending.current = next;
    const current = ++generation.current;
    setRulesError(false);
    const zones = [next.timeZone, next.statisticsTimeZone];
    if (timeZoneRulesReady(zones)) {
      setSettings(next); setReady(true); setLoadingRules(false);
      return;
    }
    setLoadingRules(true);
    void ensureTimeZoneRules(zones).then(() => {
      if (generation.current !== current) return;
      setSettings(next); setReady(true); setLoadingRules(false);
    }).catch(() => {
      if (generation.current !== current) return;
      setRulesError(true); setLoadingRules(false);
    });
  }, []);
  const cancelPending = React.useCallback(() => { generation.current++; }, []);
  React.useEffect(() => {
    const read = () => {
      try { apply(parseTimeSettings(localStorage.getItem(TIME_SETTINGS_KEY))); setStorageError(false); }
      catch { setStorageError(true); apply(pending.current); }
    };
    read();
    const onStorage = (event: StorageEvent) => { if (event.key === TIME_SETTINGS_KEY || event.key === null) read(); };
    window.addEventListener('storage', onStorage);
    return () => { cancelPending(); window.removeEventListener('storage', onStorage); };
  }, [apply, cancelPending]);
  const save = React.useCallback((value: TimeSettings) => {
    if (!validTimeZone(value.timeZone) || !validTimeZone(value.statisticsTimeZone)) return;
    try { localStorage.setItem(TIME_SETTINGS_KEY, JSON.stringify(value)); apply(value); setStorageError(false); }
    catch { setStorageError(true); }
  }, [apply]);
  const value = React.useMemo(() => ({ ...settings, ready: ready && !loadingRules, storageError, save }), [settings, ready, loadingRules, storageError, save]);
  return <TimeDisplayContext.Provider value={value}>
    {rulesError && <Alert severity="error" action={<Button onClick={() => { apply(pending.current); }}>{t('Retry')}</Button>}>{t('Could not load timezone rules.')}</Alert>}
    {ready ? children : !rulesError && <Stack sx={{ minHeight: 160, alignItems: 'center', justifyContent: 'center' }}><CircularProgress aria-label={t('Loading')} /></Stack>}
  </TimeDisplayContext.Provider>;
}

export function useTimeDisplay() {
  const settings = React.useContext(TimeDisplayContext);
  const formatTime = React.useCallback((value: number | string | Date, format?: string) => formatDisplayTime(value, settings.timeZone, format), [settings.timeZone]);
  return { ...settings, formatTime };
}
