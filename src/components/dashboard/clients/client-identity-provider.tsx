'use client';

import * as React from 'react';
import { notifyManager, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { smartdnsServer } from '@/lib/backend/server';
import { useClientNames } from './client-names-provider';
import { getClientDeviceIdentity, normalizeClientIp } from './client-identity';
import { CLIENT_REFRESH_INTERVAL } from './client-activity';
import { CLIENT_SNAPSHOT_LIMIT, clientSnapshotIPs, createClientSnapshot, snapshotClient } from './client-snapshot';

const ClientIdentityQueryContext = React.createContext<QueryClient | undefined>(undefined);
const ClientBatchContext = React.createContext<{ managed: ReadonlySet<string>; covered: ReadonlySet<string>; pending: boolean; failedAt: number; snapshot: ReturnType<typeof createClientSnapshot> | undefined; updatedAt: number } | null>(null);

export function ClientIdentityProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = useQueryClient();
  return <ClientIdentityQueryContext.Provider value={client}>{children}</ClientIdentityQueryContext.Provider>;
}

export function useClientIdentityQueryClient(): QueryClient {
  const shared = React.useContext(ClientIdentityQueryContext);
  const local = useQueryClient();
  return shared ?? local;
}

export function ClientIdentityBatchProvider({ ips, children }: { ips: readonly string[]; children: React.ReactNode }): React.JSX.Element {
  const client = useClientIdentityQueryClient();
  const { ready } = useClientNames();
  const managed = React.useMemo(() => clientSnapshotIPs(ips), [ips]);
  const sourceIps = React.useMemo(() => new Map(ips.map(ip => [normalizeClientIp(ip), ip])), [ips]);
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
    const prefetch = (ip: string) => {
      void client.fetchQuery({
        queryKey: ['client-name-lookup', ip], staleTime: CLIENT_REFRESH_INTERVAL, gcTime: 300_000, retry: false,
        queryFn: async () => {
          const result = await smartdnsServer.GetClients({ client_ip: sourceIps.get(ip) ?? ip, page_num: 1, page_size: 1 });
          if (result.error || !result.data) throw new Error('Client lookup failed');
          return result.data.client_list.find(entry => normalizeClientIp(entry.client_ip) === ip) ?? null;
        },
      }).catch(() => { /* Cells retain cached identities and show unknown activity. */ });
    };
    if (snapshot.isError) {
      // The snapshot may fail just after a concurrent exact lookup completed.
      // Recheck after that failure so a successful fallback can establish freshness.
      for (const ip of managed) { void client.invalidateQueries({ queryKey: ['client-name-lookup', ip], exact: true }); prefetch(ip); }
      return;
    }
    if (!snapshot.data) return;
    notifyManager.batch(() => {
      for (const ip of managed) {
        const entry = snapshotClient(snapshot.data, ip);
        if (entry === undefined) { prefetch(ip); continue; }
        const queryKey = ['client-name-lookup', ip];
        // A late fallback response must not overwrite the newer snapshot.
        void client.cancelQueries({ queryKey, exact: true }, { silent: true, revert: false });
        client.setQueryData(queryKey, entry, { updatedAt: snapshot.dataUpdatedAt });
      }
    });
  }, [client, managed, sourceIps, snapshot.data, snapshot.dataUpdatedAt, snapshot.isError, snapshot.errorUpdatedAt]);
  const coveredKey = JSON.stringify([...managed].filter(ip => snapshot.data && snapshotClient(snapshot.data, ip) !== undefined));
  const covered = React.useMemo(() => new Set<string>(JSON.parse(coveredKey) as string[]), [coveredKey]);
  const pending = !snapshot.data && snapshot.isPending;
  const failedAt = snapshot.isError ? snapshot.errorUpdatedAt : 0;
  const value = React.useMemo(() => ({ managed, covered, pending, failedAt, snapshot: snapshot.data, updatedAt: snapshot.dataUpdatedAt }), [managed, covered, pending, failedAt, snapshot.data, snapshot.dataUpdatedAt]);
  return <ClientBatchContext.Provider value={value}>{children}</ClientBatchContext.Provider>;
}

// Covered rows read one shared snapshot instead of creating a QueryObserver per cell.
export function useBatchClientIdentity(ip: string): ReturnType<typeof useClientIdentity> | null {
  const batch = React.useContext(ClientBatchContext);
  const client = useClientIdentityQueryClient();
  const { names, icons, iconColors, ready } = useClientNames();
  const key = normalizeClientIp(ip);
  if (!batch?.managed.has(key) || batch.failedAt || (!batch.pending && !batch.covered.has(key))) return null;
  const cached = client.getQueryState<import('@/lib/backend/server').ClientList | null>(['client-name-lookup', key]);
  const data = batch.snapshot ? snapshotClient(batch.snapshot, key) : cached?.data;
  return { ...getClientDeviceIdentity(ip, names, icons, data, iconColors), observedAt: batch.updatedAt || cached?.dataUpdatedAt || 0, lookupAvailable: ready && !batch.pending && Boolean(data) };
}

export function useClientIdentity(ip: string, withDeviceIcon = false) {
  const client = useClientIdentityQueryClient();
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
    refetchOnMount: !managed,
    refetchOnWindowFocus: false,
    refetchInterval: withDeviceIcon ? CLIENT_REFRESH_INTERVAL : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const result = await smartdnsServer.GetClients({ client_ip: ip, page_num: 1, page_size: 1 });
      if (result.error || !result.data) throw new Error('Client lookup failed');
      return result.data.client_list.find((entry) => normalizeClientIp(entry.client_ip) === key) ?? null;
    },
  }, client);
  return { ...getClientDeviceIdentity(ip, names, icons, data, iconColors), observedAt: dataUpdatedAt, lookupAvailable: ready && !isError && !isPending && Boolean(data) && (!managed || !batch?.failedAt || dataUpdatedAt >= batch.failedAt) };
}

export function useRefreshClientIdentities(): () => void {
  const client = useClientIdentityQueryClient();
  return React.useCallback(() => {
    void client.invalidateQueries({ queryKey: ['client-name-lookup'] });
    void client.invalidateQueries({ queryKey: ['client-identity-snapshot'] });
  }, [client]);
}

// Wait for terminal lookup status, including offscreen entries seeded by the batch.
export function useClientIdentitySizingReady(ips: readonly string[]): boolean {
  const client = useClientIdentityQueryClient();
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

export function useClientIdentityPageVersion(ips: readonly string[]): number {
  const client = useClientIdentityQueryClient();
  const keys = React.useMemo(() => new Set(ips.map(ip => normalizeClientIp(ip))), [ips]);
  const subscribe = React.useCallback((notify: () => void) => client.getQueryCache().subscribe(event => {
    if (event.query.queryKey[0] === 'client-name-lookup' && keys.has(String(event.query.queryKey[1]))) notify();
  }), [client, keys]);
  const snapshot = React.useCallback(() => {
    let version = 0;
    for (const key of keys) { const state = client.getQueryState(['client-name-lookup', key]); version = Math.max(version, state?.dataUpdatedAt ?? 0, state?.errorUpdatedAt ?? 0); }
    return version;
  }, [client, keys]);
  return React.useSyncExternalStore(subscribe, snapshot, () => 0);
}
