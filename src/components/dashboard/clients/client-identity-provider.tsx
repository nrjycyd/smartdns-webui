'use client';

import * as React from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { smartdnsServer } from '@/lib/backend/server';
import { useClientNames } from './client-names-provider';
import { getClientDeviceIdentity, normalizeClientIp } from './client-identity';
import { CLIENT_REFRESH_INTERVAL } from './client-activity';

const ClientIdentityQueryContext = React.createContext<QueryClient | undefined>(undefined);

export function ClientIdentityProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = useQueryClient();
  return <ClientIdentityQueryContext.Provider value={client}>{children}</ClientIdentityQueryContext.Provider>;
}

function useIdentityQueryClient(): QueryClient {
  const shared = React.useContext(ClientIdentityQueryContext);
  const local = useQueryClient();
  return shared ?? local;
}

export function useClientIdentity(ip: string, withDeviceIcon = false) {
  const client = useIdentityQueryClient();
  const { names, icons, ready } = useClientNames();
  const key = normalizeClientIp(ip);
  const { data, isError, isPending } = useQuery({
    queryKey: ['client-name-lookup', key],
    enabled: ready && Boolean(key) && (withDeviceIcon || Object.keys(names).length > 0),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: withDeviceIcon ? CLIENT_REFRESH_INTERVAL : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const result = await smartdnsServer.GetClients({ client_ip: ip, page_num: 1, page_size: 1 });
      if (result.error || !result.data) throw new Error('Client lookup failed');
      return result.data.client_list.find((entry) => normalizeClientIp(entry.client_ip) === key) ?? null;
    },
  }, client);
  return { ...getClientDeviceIdentity(ip, names, icons, data), lookupAvailable: ready && !isError && !isPending && Boolean(data) };
}

export function useRefreshClientIdentities(): () => void {
  const client = useIdentityQueryClient();
  return React.useCallback(() => { void client.invalidateQueries({ queryKey: ['client-name-lookup'] }); }, [client]);
}
