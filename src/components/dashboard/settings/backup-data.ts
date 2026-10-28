import { CLIENT_NAMES_STORAGE_KEY, parseClientNames, parseClientIcons, parseClientIconColors } from '../clients/client-names';
import { GROUP_APPEARANCE_STORAGE_KEY, parseGroupOverrides } from '../query-log/group-appearance';
import { TIME_SETTINGS_KEY, validTimeZone } from '../../../lib/display-time';

export const MAX_BACKUP_BYTES = 1024 * 1024;
export const BACKUP_KEYS = [
  CLIENT_NAMES_STORAGE_KEY, GROUP_APPEARANCE_STORAGE_KEY, TIME_SETTINGS_KEY,
  'smartdns-webui:table-density:v1', 'smartdns-webui:column-width-mode:v1',
  ...['querylog', 'clients', 'upstream-servers'].flatMap(table => [
    `${table}-table-column-visibility`, `${table}-table-column-sizing`,
    ...(table === 'upstream-servers' ? [] : [`${table}-table-pagination`]),
  ]),
  'cachedDomainsRowsPerPage', 'i18nextLng', 'user-color-scheme',
  'smartdns-color-scheme-light', 'smartdns-color-scheme-dark',
] as const;

export interface SettingsBackup {
  format: 'smartdns-webui-settings';
  version: 1;
  settings: Record<string, string | null>;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validate(key: string, raw: string | null, colorValid?: (color: string) => boolean): void {
  if (raw === null) return;
  if (key === CLIENT_NAMES_STORAGE_KEY) {
    parseClientNames(raw); parseClientIcons(raw); parseClientIconColors(raw); return;
  }
  if (key === GROUP_APPEARANCE_STORAGE_KEY) {
    const groups = parseGroupOverrides(raw);
    for (const rule of Object.values(groups)) {
      for (const color of [rule.color, rule.iconColor]) {
        if (color && colorValid && !colorValid(color)) throw new Error('Invalid color');
      }
    }
    return;
  }
  if (key === 'i18nextLng') {
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(raw)) throw new Error('Invalid language');
    return;
  }
  const enums: Record<string, string[]> = {
    'smartdns-webui:table-density:v1': ['compact', 'comfortable', 'spacious'],
    'smartdns-webui:column-width-mode:v1': ['auto', 'manual'],
    'user-color-scheme': ['light', 'dark', 'system'],
    'smartdns-color-scheme-light': ['light'], 'smartdns-color-scheme-dark': ['dark'],
    cachedDomainsRowsPerPage: ['10', '20', '50', '100'],
  };
  if (Object.hasOwn(enums, key)) {
    if (!enums[key].includes(raw)) throw new Error('Invalid preference');
    return;
  }
  const value: unknown = JSON.parse(raw);
  if (!record(value)) throw new Error('Invalid preference');
  if (key === TIME_SETTINGS_KEY) {
    if (!validTimeZone(value.timeZone) || !validTimeZone(value.statisticsTimeZone)) throw new Error('Invalid timezone');
  } else if (key.endsWith('-column-visibility')) {
    if (!Object.values(value).every(v => typeof v === 'boolean')) throw new Error('Invalid visibility');
  } else if (key.endsWith('-column-sizing')) {
    if (!Object.values(value).every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)) throw new Error('Invalid width');
  } else if (key.endsWith('-pagination')) {
    if (!Number.isSafeInteger(value.pageIndex) || Number(value.pageIndex) < 0 || ![5, 10, 15, 20, 25, 30, 50, 100].includes(Number(value.pageSize)) || typeof value.pageSize !== 'number') throw new Error('Invalid pagination');
  }
}

export function parseBackup(source: string, colorValid?: (color: string) => boolean): SettingsBackup {
  if (new TextEncoder().encode(source).length > MAX_BACKUP_BYTES) throw new Error('Backup too large');
  const data: unknown = JSON.parse(source);
  if (!record(data)) throw new Error('Invalid backup');
  // Accept the group-only files exported by older WebUI versions.
  if (!Object.hasOwn(data, 'format') && Object.hasOwn(data, 'groups')) {
    const settings = { [GROUP_APPEARANCE_STORAGE_KEY]: source };
    validate(GROUP_APPEARANCE_STORAGE_KEY, source, colorValid);
    return { format: 'smartdns-webui-settings', version: 1, settings };
  }
  if (data.format !== 'smartdns-webui-settings' || data.version !== 1 || !record(data.settings) || Object.keys(data.settings).length === 0) throw new Error('Invalid backup');
  const entries = Object.entries(data.settings).map(([key, raw]) => {
    if (!(BACKUP_KEYS as readonly string[]).includes(key) || (raw !== null && typeof raw !== 'string')) throw new Error('Unsupported setting');
    validate(key, raw, colorValid);
    return [key, raw] as const;
  });
  return { format: 'smartdns-webui-settings', version: 1, settings: Object.fromEntries(entries) };
}

export function exportBackup(storage: Pick<Storage, 'getItem'>, colorValid?: (color: string) => boolean): string {
  const settings = Object.fromEntries(BACKUP_KEYS.map(key => [key, storage.getItem(key)]));
  const source = JSON.stringify({ format: 'smartdns-webui-settings', version: 1, settings }, null, 2);
  parseBackup(source, colorValid);
  return source;
}

export function restoreBackup(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, backup: SettingsBackup, colorValid?: (color: string) => boolean): void {
  const { settings } = parseBackup(JSON.stringify(backup), colorValid);
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, storage.getItem(key)]));
  const touched: string[] = [];
  try {
    for (const [key, raw] of Object.entries(settings)) {
      touched.push(key);
      if (raw === null) storage.removeItem(key);
      else storage.setItem(key, raw);
    }
  } catch {
    let rollbackFailed = false;
    for (const key of touched.toReversed()) {
      try {
        if (previous[key] === null) storage.removeItem(key);
        else storage.setItem(key, previous[key]);
      } catch { rollbackFailed = true; }
    }
    throw new Error(rollbackFailed ? 'rollback-failed' : 'storage-failed');
  }
}
