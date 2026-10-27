import { getGroupAppearance, splitThemeColor, type GroupAppearances } from '../query-log/group-appearance';

export function groupTrendColor(name: string, groups: GroupAppearances, dark: boolean): string {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  const fallback = `hsl(${hash % 360} 60% ${dark ? 70 : 40}%)`;
  const source = getGroupAppearance(groups, name)?.color;
  if (!source || typeof document === 'undefined') return fallback;
  const color = splitThemeColor(source)[dark ? 1 : 0];
  if (!CSS.supports('color', color)) return fallback;
  // Canvas does not resolve CSS variables or light-dark(); use the same computed
  // color as the DOM group label, including browser-local appearance overrides.
  const probe = document.createElement('span');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none';
  // Preserve each group's hue while reducing saturation for quieter chart lines.
  const muted = `color-mix(in srgb, ${color} ${dark ? 80 : 65}%, ${dark ? '#b4becb' : '#88929e'})`;
  probe.style.color = CSS.supports('color', muted) ? muted : color;
  document.body.append(probe);
  try { return getComputedStyle(probe).color; } finally { probe.remove(); }
}
