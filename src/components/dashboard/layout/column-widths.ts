export interface ColumnWidthTarget {
  id: string;
  min: number;
  preferred: number;
  max: number;
  weight: number;
}

export const COPY_BUTTON_INLINE_PADDING = 4;

export type TableColumnLayout = 'query-log' | 'upstream-servers' | 'clients';

export function createColumnWidthTarget(layout: TableColumnLayout, id: string, min: number, preferred: number, max?: number): ColumnWidthTarget {
  let limit = min;
  let weight = 0;
  if (layout === 'query-log') {
    if (id === 'domain') { limit = 560; weight = 3; }
  } else if (layout === 'clients') {
    switch (id) {
      case 'client_ip': { limit = 520; weight = 3; break; }
      case 'hostname': { limit = 360; weight = 2; break; }
      case 'mac': { limit = min + 48; weight = 1; break; }
      case 'last_query_timestamp': { limit = min + 48; weight = 1; break; }
    }
  } else {
    switch (id) {
      case 'host':
      case 'ip': { limit = 320; weight = 2; break; }
      case 'security':
      case 'status': { limit = min + 24; weight = 1; break; }
      case 'query_success_rate':
      case 'avg_time':
      case 'total_query_count':
      case 'total_query_success': { limit = min + 48; weight = 1; break; }
    }
  }
  if (weight === 0) return { id, min, preferred: min, max: min, weight };
  return { id, min, preferred: Math.max(min, preferred), max: Math.max(min, max ?? limit), weight };
}

function isIpv6Address(value: string): boolean {
  const input = value.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(input);
  const address = (bracketed?.[1] ?? input).split('%')[0];
  if (!address.includes(':')) return false;
  try {
    return new URL(`http://[${address}]/`).hostname.startsWith('[');
  } catch { return false; }
}

export function measureColumnContent(id: string, values: readonly string[], measure: (value: string) => number, includeIpv6 = false): number {
  const ipColumn = /^ip$|^client$|_ip$/.test(id);
  let width = 0;
  for (const value of values) {
    if (ipColumn && !includeIpv6 && isIpv6Address(value)) continue;
    width = Math.max(width, measure(value));
  }
  return width;
}

export const singleLineCellSx = {
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  '& > span': { minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
} as const;

export const singleLineCopySx = {
  paddingLeft: `${COPY_BUTTON_INLINE_PADDING}px`, paddingRight: `${COPY_BUTTON_INLINE_PADDING}px`,
  justifyContent: 'flex-start',
  minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  '& > span': { minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
} as const;

export const singleLineHeaderSx = { '& .Mui-TableHeadCell-Content-Wrapper': { whiteSpace: 'nowrap' } } as const;

export function fitColumnWidths(columns: readonly ColumnWidthTarget[], available: number): Record<string, number> {
  if (columns.length === 0) return {};
  const minimum = columns.reduce((sum, column) => sum + column.min, 0);
  const widths = columns.map((column) => Math.max(column.min, Math.min(column.max, column.preferred)));
  const preferred = widths.reduce((sum, width) => sum + width, 0);
  const budget = Math.max(minimum, Math.floor(available));

  if (budget < preferred) {
    const ratio = (budget - minimum) / (preferred - minimum);
    for (const [index, column] of columns.entries()) widths[index] = column.min + (widths[index] - column.min) * ratio;
  } else {
    let remaining = budget - preferred;
    let active = columns.map((column, index) => index).filter((index) => columns[index].weight > 0 && widths[index] < columns[index].max);
    while (remaining > 0.01 && active.length > 0) {
      const weight = active.reduce((sum, index) => sum + columns[index].weight, 0);
      let used = 0;
      for (const index of active) {
        const extra = Math.min(columns[index].max - widths[index], remaining * columns[index].weight / weight);
        widths[index] += extra;
        used += extra;
      }
      remaining -= used;
      active = active.filter((index) => widths[index] < columns[index].max - 0.01);
    }
  }

  const rounded = widths.map((width) => Math.floor(width));
  let remainder = Math.min(budget, Math.round(widths.reduce((sum, width) => sum + width, 0))) - rounded.reduce((sum, width) => sum + width, 0);
  const order = columns.map((_, index) => index).toSorted((a, b) => (widths[b] - rounded[b]) - (widths[a] - rounded[a]));
  for (const index of order) {
    if (remainder > 0 && rounded[index] < columns[index].max) { rounded[index]++; remainder--; }
  }
  return Object.fromEntries(columns.map((column, index) => [column.id, rounded[index]]));
}
