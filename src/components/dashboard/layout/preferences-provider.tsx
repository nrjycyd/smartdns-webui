'use client';

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { authClient } from '@/lib/auth/client';
import { createDashboardQueryClient, watchQueryLogCache } from '@/components/dashboard/query-log/query-log-cache';
import { GroupAppearanceProvider } from '@/components/dashboard/query-log/group-label';
import { TableDensityProvider } from './table-density-provider';
import { ClientIdentityProvider } from '@/components/dashboard/clients/client-identity-provider';
import { ClientNamesProvider } from '@/components/dashboard/clients/client-names-provider';
import { TableWidthProvider } from './table-width-provider';
import { TimeDisplayProvider } from './time-display-provider';

export function DashboardPreferencesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = React.useState(createDashboardQueryClient);
  React.useEffect(() => {
    const stop = watchQueryLogCache(client);
    const signOut = authClient.subscribeSignOut(() => { client.clear(); });
    return () => { stop(); signOut(); client.clear(); };
  }, [client]);
  return <QueryClientProvider client={client}><TimeDisplayProvider><TableDensityProvider><TableWidthProvider><ClientNamesProvider><ClientIdentityProvider><GroupAppearanceProvider>{children}</GroupAppearanceProvider></ClientIdentityProvider></ClientNamesProvider></TableWidthProvider></TableDensityProvider></TimeDisplayProvider></QueryClientProvider>;
}
