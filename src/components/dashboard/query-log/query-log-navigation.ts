import type { MRT_ColumnFiltersState } from 'material-react-table';
import { moment } from '@/lib/display-time';

const FILTER_COLUMNS = new Set(['id', 'domain', 'domain_type', 'client', 'domain_group', 'is_blocked', 'reply_code']);

export function parseQueryLogSearch(search: string): { filters: MRT_ColumnFiltersState; totalCount?: number } {
  const filters: MRT_ColumnFiltersState = [];
  const timestamp: (moment.Moment | undefined)[] = [undefined, undefined];
  let totalCount: number | undefined;
  for (const [key, value] of new URLSearchParams(search)) {
    if (key === 'timestamp_after' || key === 'timestamp_before') {
      const parsed = moment.utc(Number(value));
      if (parsed.isValid()) timestamp[key === 'timestamp_after' ? 0 : 1] = parsed;
    } else if (key === 'total_count') {
      const count = Number(value);
      if (Number.isSafeInteger(count) && count >= 0) totalCount = count;
    } else if (FILTER_COLUMNS.has(key)) filters.push({ id: key, value });
  }
  if (timestamp.some(Boolean)) filters.push({ id: 'timestamp', value: timestamp });
  return { filters, totalCount };
}

export function sameQueryLogState(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
