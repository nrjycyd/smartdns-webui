export interface GroupAppearance {
  color?: string;
  icon?: string;
  iconColor?: string;
}

export type GroupAppearances = Readonly<Record<string, GroupAppearance>>;
export const EMPTY_GROUP_APPEARANCES: GroupAppearances = Object.freeze({});
export const GROUP_APPEARANCE_STORAGE_KEY = 'smartdns-webui:group-appearance:v1';
export type GroupAppearanceField = keyof GroupAppearance;
export const GROUP_APPEARANCE_FIELDS: GroupAppearanceField[] = ['color', 'icon', 'iconColor'];

export function isGroupIconName(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

export function parseGroupAppearances(source: string): GroupAppearances {
  try {
    const parsed: unknown = JSON.parse(source);
    if (!isObject(parsed) || !isObject(parsed.groups)) return EMPTY_GROUP_APPEARANCES;
    const entries: [string, GroupAppearance][] = [];
    for (const [name, value] of Object.entries(parsed.groups)) {
      if (!isObject(value)) continue;
      const color = text(value.color);
      const iconName = text(value.icon);
      // Use the public Iconify namespace; arbitrary URLs/providers are not icon names.
      const icon = iconName && isGroupIconName(iconName) ? iconName : undefined;
      const iconColor = icon ? text(value.iconColor) : undefined;
      if (color || icon) entries.push([name, { color, icon, iconColor }]);
    }
    return entries.length > 0 ? Object.fromEntries(entries) : EMPTY_GROUP_APPEARANCES;
  } catch {
    return EMPTY_GROUP_APPEARANCES;
  }
}

export function getGroupAppearance(groups: GroupAppearances, group: string): GroupAppearance | undefined {
  return Object.hasOwn(groups, group) ? groups[group] : undefined;
}

// Missing fields inherit the file default; an explicitly empty string clears it.
export function mergeGroupAppearances(defaults: GroupAppearances, overrides: GroupAppearances): GroupAppearances {
  const entries: [string, GroupAppearance][] = [];
  for (const name of new Set([...Object.keys(defaults), ...Object.keys(overrides)])) {
    const base = getGroupAppearance(defaults, name) ?? {};
    const custom = getGroupAppearance(overrides, name) ?? {};
    const result: GroupAppearance = {};
    for (const field of GROUP_APPEARANCE_FIELDS) {
      const value = Object.hasOwn(custom, field) ? custom[field] : base[field];
      if (value) result[field] = value;
    }
    if (!result.icon) delete result.iconColor;
    if (result.color || result.icon) entries.push([name, result]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : EMPTY_GROUP_APPEARANCES;
}

export function parseGroupOverrides(source: string): GroupAppearances {
  const parsed: unknown = JSON.parse(source);
  if (!isObject(parsed) || !isObject(parsed.groups) || (parsed.version !== undefined && parsed.version !== 1)) {
    throw new Error('Invalid group appearance settings.');
  }
  const entries: [string, GroupAppearance][] = [];
  for (const [name, value] of Object.entries(parsed.groups)) {
    if (!name.trim() || !isObject(value)) throw new Error('Invalid group appearance settings.');
    const rule: GroupAppearance = {};
    for (const field of GROUP_APPEARANCE_FIELDS) {
      if (!Object.hasOwn(value, field)) continue;
      const raw = value[field];
      if (raw !== null && typeof raw !== 'string') throw new Error('Invalid group appearance settings.');
      const normalized = text(raw) ?? '';
      if (field === 'icon' && normalized && !isGroupIconName(normalized)) throw new Error('Invalid Iconify icon name.');
      rule[field] = normalized;
    }
    if (Object.keys(rule).length > 0) entries.push([name, rule]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : EMPTY_GROUP_APPEARANCES;
}

export function serializeGroupOverrides(groups: GroupAppearances): string {
  return JSON.stringify({ version: 1, groups: Object.fromEntries(Object.keys(groups).toSorted().map((name) => [name, groups[name]])) }, null, 2);
}

export function setGroupOverride(groups: GroupAppearances, name: string, field: GroupAppearanceField, value: string | undefined): GroupAppearances {
  const result = { ...groups };
  const rule = { ...getGroupAppearance(groups, name) };
  if (value === undefined) delete rule[field];
  else rule[field] = value;
  if (Object.keys(rule).length === 0) delete result[name];
  else Object.defineProperty(result, name, { value: rule, enumerable: true, configurable: true, writable: true });
  return result;
}

export function splitThemeColor(value: string): [string, string] {
  const source = value.trim();
  if (source.startsWith('light-dark(') && source.endsWith(')')) {
    const body = source.slice(11, -1);
    let depth = 0;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '(') depth++;
      if (body[i] === ')') depth--;
      if (body[i] === ',' && depth === 0) return [body.slice(0, i).trim(), body.slice(i + 1).trim()];
    }
  }
  return [source, source];
}

export function joinThemeColors(light: string, dark: string): string {
  return light.trim() === dark.trim() ? light.trim() : `light-dark(${light.trim()}, ${dark.trim()})`;
}
