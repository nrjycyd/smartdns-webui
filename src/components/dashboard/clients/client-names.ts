export const CLIENT_NAMES_STORAGE_KEY = 'smartdns-webui:client-names:v1';
export type ClientNames = Readonly<Record<string, string>>;

export function normalizeMac(value: string | null | undefined): string | undefined {
  const input = value?.trim() ?? '';
  if (!/^(?:[\da-f]{12}|(?:[\da-f]{2}:){5}[\da-f]{2}|(?:[\da-f]{2}-){5}[\da-f]{2}|(?:[\da-f]{4}\.){2}[\da-f]{4})$/i.test(input)) return undefined;
  const digits = input.replaceAll(/[:.-]/g, '').toUpperCase();
  if (digits === '000000000000' || digits === 'FFFFFFFFFFFF') return undefined;
  return digits.match(/.{2}/g)?.join(':');
}

export function isValidClientName(value: string): boolean {
  return value.trim().length <= 64 && ![...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

export function getClientName(names: ClientNames, mac: string | null | undefined): string | undefined {
  const key = normalizeMac(mac);
  return key && Object.hasOwn(names, key) ? names[key] : undefined;
}

export function parseClientNames(source: string | null): ClientNames {
  if (source === null) return {};
  const data: unknown = JSON.parse(source);
  if (!data || typeof data !== 'object' || Array.isArray(data) || !('version' in data) || data.version !== 1 || !('names' in data) || !data.names || typeof data.names !== 'object' || Array.isArray(data.names)) throw new Error('Invalid client names');
  const result: Record<string, string> = {};
  for (const [mac, name] of Object.entries(data.names)) {
    const key = normalizeMac(mac);
    if (!key || typeof name !== 'string' || !isValidClientName(name)) throw new Error('Invalid client name');
    if (name.trim()) result[key] = name.trim();
  }
  return result;
}

export function updateClientName(names: ClientNames, mac: string, name: string): ClientNames {
  const key = normalizeMac(mac);
  if (!key || !isValidClientName(name)) throw new Error('Invalid client name');
  const next = { ...names };
  if (name.trim()) next[key] = name.trim();
  else delete next[key];
  return next;
}

export function isValidClientIcon(value: string): boolean {
  return value === '' || (value.length <= 128 && /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value));
}

export function parseClientIcons(source: string | null): ClientNames {
  // Validate the existing envelope before reading the optional icon map.
  parseClientNames(source);
  if (source === null) return {};
  const data = JSON.parse(source) as { icons?: unknown };
  if (data.icons === undefined) return {};
  if (!data.icons || typeof data.icons !== 'object' || Array.isArray(data.icons)) throw new Error('Invalid client icons');
  const icons: Record<string, string> = {};
  for (const [mac, icon] of Object.entries(data.icons)) {
    const key = normalizeMac(mac);
    if (!key || typeof icon !== 'string' || !isValidClientIcon(icon)) throw new Error('Invalid client icon');
    icons[key] = icon;
  }
  return icons;
}

export function updateClientIcon(icons: ClientNames, mac: string, icon: string | undefined): ClientNames {
  const key = normalizeMac(mac);
  if (!key || (icon !== undefined && !isValidClientIcon(icon))) throw new Error('Invalid client icon');
  const next = { ...icons };
  if (icon === undefined) delete next[key];
  else next[key] = icon;
  return next;
}

export function serializeClientNames(names: ClientNames, icons?: ClientNames): string {
  return JSON.stringify({ version: 1, names, ...(icons && Object.keys(icons).length > 0 ? { icons } : {}) });
}
