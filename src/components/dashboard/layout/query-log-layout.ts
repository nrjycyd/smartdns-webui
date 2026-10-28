import type { ColumnWidthTarget } from './column-widths';
import type { TableDensity } from './table-density-provider';

export function queryLogAlignment(id: string): 'left' | 'center' | 'right' {
  if (['domain_type', 'domain_group', 'is_blocked', 'is_cached', 'ping_time', 'query_time', 'reply_code', 'mrt-row-actions'].includes(id)) return 'center';
  return 'left';
}

export function queryLogNumeric(id: string): boolean {
  return ['id', 'ping_time', 'query_time', 'reply_code'].includes(id);
}

export function queryLogPadding(density: TableDensity, rem = 16): number {
  return rem * (density === 'compact' ? 0.25 : density === 'comfortable' ? 0.5 : 0.75);
}

const MINIMUMS: Readonly<Record<string, number>> = {
  id: 88, domain_type: 80, domain_group: 104, is_blocked: 88,
  is_cached: 80, ping_time: 64, query_time: 80, reply_code: 80, client: 120,
};

export function queryLogColumnTarget(target: ColumnWidthTarget, rem = 16, retained = 0): ColumnWidthTarget {
  const minimum = Math.ceil(Math.max(target.min, (MINIMUMS[target.id] ?? 0) * rem / 16, retained) / 8) * 8;
  if (target.id === 'domain') return { ...target, min: minimum, preferred: Math.max(minimum, target.preferred), max: Number.POSITIVE_INFINITY, weight: 1 };
  return { ...target, min: minimum, preferred: minimum, max: minimum, weight: 0 };
}

export function mergeQueryLogWidths(previous: Readonly<Record<string, number>>, next: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(Object.entries(next).map(([id, width]) => [id, Math.max(previous[id] ?? 0, width)]));
}
