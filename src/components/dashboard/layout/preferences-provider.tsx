'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupAppearanceProvider } from '@/components/dashboard/query-log/group-label';
import { TableDensityProvider } from './table-density-provider';
import { ClientIdentityProvider } from '@/components/dashboard/clients/client-identity-provider';
import { ClientNamesProvider } from '@/components/dashboard/clients/client-names-provider';
import { TableWidthProvider } from './table-width-provider';

export function DashboardPreferencesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={client}><TableDensityProvider><TableWidthProvider><ClientNamesProvider><ClientIdentityProvider><GroupAppearanceProvider>{children}</GroupAppearanceProvider></ClientIdentityProvider></ClientNamesProvider></TableWidthProvider></TableDensityProvider></QueryClientProvider>;
}
