'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupAppearanceProvider } from '@/components/dashboard/query-log/group-label';
import { TableDensityProvider } from './table-density-provider';

export function DashboardPreferencesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={client}><TableDensityProvider><GroupAppearanceProvider>{children}</GroupAppearanceProvider></TableDensityProvider></QueryClientProvider>;
}
