import type { ClientList, ClientListResponse } from '@/lib/backend/server';
import { normalizeClientIp } from './client-identity';

export const CLIENT_SNAPSHOT_LIMIT = 256;
export const CLIENT_SNAPSHOT_MIN_IPS = 4;
export interface ClientSnapshot { clients: ReadonlyMap<string, ClientList>; complete: boolean }

export function clientSnapshotIPs(ips: readonly string[]): ReadonlySet<string> {
  const unique = new Set(ips.map(ip => normalizeClientIp(ip)).filter(Boolean));
  return unique.size >= CLIENT_SNAPSHOT_MIN_IPS ? unique : new Set();
}

// A single bounded page avoids one request per visible IP on typical networks.
// An absent entry in a partial page must still use the exact-IP endpoint.
export function createClientSnapshot(data: ClientListResponse): ClientSnapshot {
  if (!Array.isArray(data.client_list) || data.client_list.length > CLIENT_SNAPSHOT_LIMIT ||
      !Number.isSafeInteger(data.total_count) || data.total_count < data.client_list.length) throw new Error('Invalid client snapshot');
  const clients = new Map<string, ClientList>();
  for (const entry of data.client_list) {
    if (!entry || typeof entry.client_ip !== 'string' || !entry.client_ip.trim()) throw new Error('Invalid client address');
    const key = normalizeClientIp(entry.client_ip);
    if (!clients.has(key)) clients.set(key, entry);
  }
  return { clients, complete: data.total_count === data.client_list.length };
}

export function snapshotClient(snapshot: ClientSnapshot, ip: string): ClientList | null | undefined {
  return snapshot.clients.get(normalizeClientIp(ip)) ?? (snapshot.complete ? null : undefined);
}
