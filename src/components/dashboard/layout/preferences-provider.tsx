'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupAppearanceProvider } from '@/components/dashboard/query-log/group-label';

export function DashboardPreferencesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={client}><GroupAppearanceProvider>{children}</GroupAppearanceProvider></QueryClientProvider>;
}
