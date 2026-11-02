'use client';

import * as React from 'react';
import Stack from '@mui/material/Stack';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { authClient } from '@/lib/auth/client';
import { paths } from '@/paths';
import { QueryLogViewContext, type QueryLogViewProps } from './query-log-view';

export function QueryLogRetained({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { user, checkSessionError } = useUser();
  const active = usePathname() === paths.dashboard.queryLog;
  const search = useSearchParams().toString();
  const [navigation, setNavigation] = React.useState({ active, visited: active, search: active ? search : '', entry: 0 });
  const [registered, setRegistered] = React.useState<{ original: React.ComponentType<QueryLogViewProps>; view: React.ComponentType<QueryLogViewProps> } | null>(null);
  if (navigation.active !== active || (active && navigation.search !== search)) {
    setNavigation(previous => ({ active, visited: previous.visited || active, search: active ? search : previous.search, entry: active ? previous.entry + 1 : previous.entry }));
  }
  const register = React.useCallback((view: React.ComponentType<QueryLogViewProps>) => {
    setRegistered(previous => previous?.original === view ? previous : { original: view, view: React.memo(view) });
  }, []);
  React.useEffect(() => authClient.subscribeSignOut(() => {
    setNavigation(previous => ({ ...previous, visited: false }));
    setRegistered(null);
  }), []);

  const View = registered?.view;
  return <QueryLogViewContext.Provider value={register}>{children}{user && navigation.visited && View && <React.Activity mode={navigation.active ? 'visible' : 'hidden'}>
    <Stack spacing={2} data-retained-query-log>
      <View search={navigation.search} entry={navigation.entry} checkSessionError={checkSessionError} />
    </Stack>
  </React.Activity>}</QueryLogViewContext.Provider>;
}
