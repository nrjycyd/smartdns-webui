export interface GroupAppearance {
  color?: string;
  icon?: string;
  iconColor?: string;
}

export type GroupAppearances = Readonly<Record<string, GroupAppearance>>;
export const EMPTY_GROUP_APPEARANCES: GroupAppearances = Object.freeze({});

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
      const icon = iconName && /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(iconName) ? iconName : undefined;
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
