'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupAppearanceProvider } from '@/components/dashboard/query-log/group-label';
import { TableDensityProvider } from './table-density-provider';
import { ClientIdentityProvider } from '@/components/dashboard/clients/client-identity-provider';
import { ClientNamesProvider } from '@/components/dashboard/clients/client-names-provider';
import { TableWidthProvider } from './table-width-provider';
import { TimeDisplayProvider } from './time-display-provider';
import { GroupTrendProvider } from '../overview/group-trend-provider';

export function DashboardPreferencesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={client}><TimeDisplayProvider><TableDensityProvider><TableWidthProvider><ClientNamesProvider><ClientIdentityProvider><GroupAppearanceProvider><GroupTrendProvider>{children}</GroupTrendProvider></GroupAppearanceProvider></ClientIdentityProvider></ClientNamesProvider></TableWidthProvider></TableDensityProvider></TimeDisplayProvider></QueryClientProvider>;
}
