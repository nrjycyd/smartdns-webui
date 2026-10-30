'use client';

import * as React from 'react';
import { notifyManager, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { smartdnsServer, type ClientList } from '@/lib/backend/server';
import { useClientNames } from './client-names-provider';
import { getClientDeviceIdentity, normalizeClientIp } from './client-identity';
import { CLIENT_REFRESH_INTERVAL } from './client-activity';
import { CLIENT_SNAPSHOT_LIMIT, CLIENT_SNAPSHOT_MIN_IPS, clientSnapshotIPs, createClientSnapshot, snapshotClient, type ClientSnapshot } from './client-snapshot';

const ClientIdentityQueryContext = React.createContext<QueryClient | undefined>(undefined);
interface ClientLookup {
  data: ClientList | null | undefined;
  dataUpdatedAt: number;
  isError: boolean;
  isPending: boolean;
}
const ClientBatchContext = React.createContext<{ managed: ReadonlySet<string>; covered: ReadonlySet<string>; pending: boolean; failedAt: number; lookups: ReadonlyMap<string, ClientLookup>; lastSnapshot: ClientSnapshot | undefined; snapshotUpdatedAt: number } | null>(null);

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
    queryFn: async ({ signal }) => {
      const result = await smartdnsServer.GetClients({ page_num: 1, page_size: CLIENT_SNAPSHOT_LIMIT }, signal);
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
  const lookups = React.useMemo(() => {
    const result = new Map<string, ClientLookup>();
    if (snapshot.isError) return result;
    for (const ip of managed) {
      const entry = snapshot.data ? snapshotClient(snapshot.data, ip) : undefined;
      if (entry !== undefined) {
        result.set(ip, { data: entry, dataUpdatedAt: snapshot.dataUpdatedAt, isError: false, isPending: false });
      } else if (pending) {
        const cached = client.getQueryState<ClientList | null>(['client-name-lookup', ip]);
        result.set(ip, { data: cached?.data, dataUpdatedAt: cached?.dataUpdatedAt ?? 0, isError: cached?.status === 'error', isPending: !cached || cached.status === 'pending' });
      }
    }
    return result;
  }, [client, managed, pending, snapshot.data, snapshot.dataUpdatedAt, snapshot.isError]);
  const value = React.useMemo(() => ({ managed, covered, pending, failedAt, lookups, lastSnapshot: snapshot.data, snapshotUpdatedAt: snapshot.dataUpdatedAt }), [managed, covered, pending, failedAt, lookups, snapshot.data, snapshot.dataUpdatedAt]);
  const uniqueIps = React.useMemo(() => {
    const unique = new Map<string, string>();
    for (const ip of ips) {
      const key = normalizeClientIp(ip);
      if (key && !unique.has(key)) unique.set(key, ip);
    }
    return [...unique.values()];
  }, [ips]);
  return <ClientBatchContext.Provider value={value}>
    <React.Fragment key="lookups">{uniqueIps.filter(ip => !lookups.has(normalizeClientIp(ip))).map(ip => <ClientIdentityLookup key={normalizeClientIp(ip)} ip={ip} />)}</React.Fragment>
    <React.Fragment key="content">{children}</React.Fragment>
  </ClientBatchContext.Provider>;
}

// One observer per distinct fallback IP, regardless of how many rows repeat it.
function ClientIdentityLookup({ ip }: { ip: string }): null {
  useClientIdentity(ip, true);
  return null;
}

// Covered rows share one query observer. Only fallback rows subscribe to their
// exact-IP cache entry; switching data sources never replaces the cell DOM.
export function useQueryLogClientIdentity(ip: string): ReturnType<typeof useClientIdentity> {
  const client = useIdentityQueryClient();
  const batch = React.useContext(ClientBatchContext);
  const { names, icons, iconColors, ready } = useClientNames();
  const key = normalizeClientIp(ip);
  const lookup = batch?.lookups.get(key);
  const needsFallback = !lookup;
  const subscribe = React.useCallback((notify: () => void) => {
    if (!needsFallback) return () => {};
    return client.getQueryCache().subscribe(event => {
      if (event.query.queryKey[0] === 'client-name-lookup' && event.query.queryKey[1] === key) notify();
    });
  }, [client, key, needsFallback]);
  const snapshot = React.useCallback(() => needsFallback ? client.getQueryState<ClientList | null>(['client-name-lookup', key]) : undefined, [client, key, needsFallback]);
  const cached = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  // Inactive exact-IP entries may have been collected while the snapshot stayed
  // mounted. Retain its last identity on failure until an exact result replaces it.
  const stale = !lookup && batch?.lastSnapshot ? snapshotClient(batch.lastSnapshot, key) : undefined;
  const data = lookup ? lookup.data : cached?.data === undefined ? stale : cached.data;
  const observedAt = lookup ? lookup.dataUpdatedAt : cached?.data === undefined ? stale === undefined ? 0 : batch?.snapshotUpdatedAt ?? 0 : cached.dataUpdatedAt;
  const isError = lookup ? lookup.isError : cached?.status === 'error';
  const isPending = lookup ? lookup.isPending : stale === undefined && (!cached || cached.status === 'pending');
  const managed = batch?.managed.has(key) ?? false;
  return { ...getClientDeviceIdentity(ip, names, icons, data, iconColors), observedAt, lookupPending: isPending && !isError, lookupAvailable: ready && !isError && !isPending && Boolean(data) && (!managed || !batch?.failedAt || observedAt >= batch.failedAt) };
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
    queryFn: async ({ signal }) => {
      const result = await smartdnsServer.GetClients({ client_ip: ip, page_num: 1, page_size: 1 }, signal);
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

// Resolve only when an editor is opened, reusing the shared exact-IP cache
// populated by both snapshots and individual lookups. No per-row observer.
export function useResolveClientIdentity(): (ip: string) => Promise<ClientList | null> {
  const client = useIdentityQueryClient();
  return React.useCallback(async (ip: string) => client.fetchQuery({
    queryKey: ['client-name-lookup', normalizeClientIp(ip)],
    staleTime: CLIENT_REFRESH_INTERVAL,
    queryFn: async ({ signal }) => {
      const result = await smartdnsServer.GetClients({ client_ip: ip, page_num: 1, page_size: 1 }, signal);
      if (result.error || !result.data) throw new Error('Client lookup failed');
      return result.data.client_list.find(entry => normalizeClientIp(entry.client_ip) === normalizeClientIp(ip)) ?? null;
    },
  }), [client]);
}

// Coalesce the synchronous cache writes of one snapshot before checking every IP.
export function useClientIdentitySizingReady(ips: readonly string[]): boolean {
  const client = useIdentityQueryClient();
  const keys = React.useMemo(() => new Set(ips.map((ip) => normalizeClientIp(ip))), [ips]);
  const subscribe = React.useCallback((notify: () => void) => {
    let active = true;
    let scheduled = false;
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      const kind = event.query.queryKey[0];
      if ((kind !== 'client-identity-snapshot' && (kind !== 'client-name-lookup' || !keys.has(String(event.query.queryKey[1])))) || scheduled) return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; if (active) notify(); });
    });
    return () => { active = false; unsubscribe(); };
  }, [client, keys]);
  const snapshot = React.useCallback(() => {
    const batch = keys.size >= CLIENT_SNAPSHOT_MIN_IPS ? client.getQueryState<ClientSnapshot>(['client-identity-snapshot']) : undefined;
    return keys.size > 0 && [...keys].every((key) => {
      // Covered rows remain ready even if their unobserved exact-IP cache
      // entries are collected; the active snapshot owns their live data.
      if (batch?.status === 'success' && batch.data && snapshotClient(batch.data, key) !== undefined) return true;
      const status = client.getQueryState(['client-name-lookup', key])?.status;
      return status === 'success' || status === 'error';
    });
  }, [client, keys]);
  return React.useSyncExternalStore(subscribe, snapshot, () => false);
}
