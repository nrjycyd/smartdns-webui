import { getClientName, type ClientNames } from './client-names';

export function normalizeClientIp(value: string): string {
  const input = value.trim();
  const parts = input.split('%');
  if (!parts[0].includes(':') || parts.length > 2) return input;
  try {
    const host = new URL(`http://[${parts[0]}]/`).hostname;
    return host.startsWith('[') ? `${host}${parts[1] ? `%${parts[1]}` : ''}` : input;
  } catch {
    return input;
  }
}

export function getClientIdentity(ip: string, names: ClientNames, client?: { client_ip: string; mac?: string | null } | null): { name: string | undefined; tooltip: string } {
  const matches = client && normalizeClientIp(client.client_ip) === normalizeClientIp(ip);
  const name = matches ? getClientName(names, client.mac) : undefined;
  return { name, tooltip: name ? `${name} · ${ip}` : ip };
}

export function getClientDeviceIdentity(ip: string, names: ClientNames, icons: ClientNames, client?: { client_ip: string; mac?: string | null; last_query_timestamp?: number } | null): { name: string | undefined; tooltip: string; icon: string | undefined; lastQueryTimestamp: number | undefined } {
  const matches = client && normalizeClientIp(client.client_ip) === normalizeClientIp(ip);
  return {
    ...getClientIdentity(ip, names, client),
    icon: matches ? getClientName(icons, client.mac) : undefined,
    lastQueryTimestamp: matches ? client.last_query_timestamp : undefined,
  };
}
