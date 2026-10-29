'use client';

import * as React from 'react';
import { notifyManager, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { smartdnsServer } from '@/lib/backend/server';
import { useClientNames } from './client-names-provider';
import { getClientDeviceIdentity, normalizeClientIp } from './client-identity';
import { CLIENT_REFRESH_INTERVAL } from './client-activity';
import { CLIENT_SNAPSHOT_LIMIT, clientSnapshotIPs, createClientSnapshot, snapshotClient } from './client-snapshot';

const ClientIdentityQueryContext = React.createContext<QueryClient | undefined>(undefined);
const ClientBatchContext = React.createContext<{ managed: ReadonlySet<string>; covered: ReadonlySet<string>; pending: boolean; failedAt: number } | null>(null);

export function ClientIdentityProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = useQueryClient();
  return <ClientIdentityQueryContext.Provider value={client}>{children}</ClientIdentityQueryContext.Provider>;
}

function useIdentityQueryClient(): QueryClient {
  const shared = React.useContext(ClientIdentityQueryContext);
  const local = useQueryClient();
  return shared ?? local;
}

export function ClientIdentityBatchProvider({ ips, children }: { ips: readonly string[]; children: React.ReactNode }): React.JSX.Element {
  const client = useIdentityQueryClient();
  const { ready } = useClientNames();
  const managed = React.useMemo(() => clientSnapshotIPs(ips), [ips]);
  const snapshot = useQuery({
    queryKey: ['client-identity-snapshot'],
    enabled: ready && managed.size > 0,
    staleTime: CLIENT_REFRESH_INTERVAL,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: CLIENT_REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const result = await smartdnsServer.GetClients({ page_num: 1, page_size: CLIENT_SNAPSHOT_LIMIT });
      if (result.error || !result.data) throw new Error('Client snapshot failed');
      return createClientSnapshot(result.data);
    },
  }, client);
  React.useEffect(() => {
    if (snapshot.isError) {
      // The snapshot may fail just after a concurrent exact lookup completed.
      // Recheck after that failure so a successful fallback can establish freshness.
      for (const ip of managed) void client.invalidateQueries({ queryKey: ['client-name-lookup', ip], exact: true });
      return;
    }
    if (!snapshot.data) return;
    notifyManager.batch(() => {
      for (const ip of managed) {
        const entry = snapshotClient(snapshot.data, ip);
        if (entry === undefined) continue;
        const queryKey = ['client-name-lookup', ip];
        // A late fallback response must not overwrite the newer snapshot.
        void client.cancelQueries({ queryKey, exact: true }, { silent: true, revert: false });
        client.setQueryData(queryKey, entry, { updatedAt: snapshot.dataUpdatedAt });
      }
    });
  }, [client, managed, snapshot.data, snapshot.dataUpdatedAt, snapshot.isError, snapshot.errorUpdatedAt]);
  const coveredKey = JSON.stringify([...managed].filter(ip => snapshot.data && snapshotClient(snapshot.data, ip) !== undefined));
  const covered = React.useMemo(() => new Set<string>(JSON.parse(coveredKey) as string[]), [coveredKey]);
  const pending = !snapshot.data && snapshot.isPending;
  const failedAt = snapshot.isError ? snapshot.errorUpdatedAt : 0;
  const value = React.useMemo(() => ({ managed, covered, pending, failedAt }), [managed, covered, pending, failedAt]);
  return <ClientBatchContext.Provider value={value}>{children}</ClientBatchContext.Provider>;
}

export function useClientIdentity(ip: string, withDeviceIcon = false) {
  const client = useIdentityQueryClient();
  const { names, icons, iconColors, ready } = useClientNames();
  const key = normalizeClientIp(ip);
  const batch = React.useContext(ClientBatchContext);
  const managed = batch?.managed.has(key) ?? false;
  const fallback = !managed || (!batch?.pending && (!batch?.covered.has(key) || batch.failedAt > 0));
  const { data, dataUpdatedAt, isError, isPending } = useQuery({
    queryKey: ['client-name-lookup', key],
    enabled: ready && Boolean(key) && (withDeviceIcon || Object.keys(names).length > 0) && fallback,
    staleTime: managed ? 0 : 60_000,
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
  return { ...getClientDeviceIdentity(ip, names, icons, data, iconColors), observedAt: dataUpdatedAt, lookupPending: isPending && !isError, lookupAvailable: ready && !isError && !isPending && Boolean(data) && (!managed || !batch?.failedAt || dataUpdatedAt >= batch.failedAt) };
}

export function useRefreshClientIdentities(): () => void {
  const client = useIdentityQueryClient();
  return React.useCallback(() => {
    void client.invalidateQueries({ queryKey: ['client-name-lookup'] });
    void client.invalidateQueries({ queryKey: ['client-identity-snapshot'] });
  }, [client]);
}

// Subscribe to readiness only; cells own the existing, deduplicated requests.
export function useClientIdentitySizingReady(ips: readonly string[]): boolean {
  const client = useIdentityQueryClient();
  const keys = React.useMemo(() => new Set(ips.map((ip) => normalizeClientIp(ip))), [ips]);
  const subscribe = React.useCallback((notify: () => void) => client.getQueryCache().subscribe((event) => {
    if (event.query.queryKey[0] === 'client-name-lookup' && keys.has(String(event.query.queryKey[1]))) notify();
  }), [client, keys]);
  const snapshot = React.useCallback(() => keys.size > 0 && [...keys].every((key) => {
    const status = client.getQueryState(['client-name-lookup', key])?.status;
    return status === 'success' || status === 'error';
  }), [client, keys]);
  return React.useSyncExternalStore(subscribe, snapshot, () => false);
}
