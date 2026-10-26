interface Pagination {
  pageIndex: number;
  pageSize: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPreference<T>(key: string, parse: (value: unknown) => T | undefined, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return fallback;
    const value = parse(JSON.parse(stored) as unknown);
    if (value !== undefined) return value;
  } catch {
    // Reset only this preference, preserving names and other browser settings.
  }
  try { window.localStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
  return fallback;
}

export function readTablePagination(key: string): Pagination {
  return readPreference(key, (value) => {
    if (!isRecord(value) || !Number.isSafeInteger(value.pageIndex) || Number(value.pageIndex) < 0 ||
        ![5, 10, 15, 20, 25, 30, 50, 100].includes(Number(value.pageSize)) || typeof value.pageSize !== 'number') return;
    return { pageIndex: Number(value.pageIndex), pageSize: value.pageSize };
  }, { pageIndex: 0, pageSize: 10 });
}

export function readColumnVisibility(key: string): Record<string, boolean> {
  return readPreference(key, (value) => isRecord(value) && Object.values(value).every((entry) => typeof entry === 'boolean') ? value as Record<string, boolean> : undefined, {});
}

export function readColumnSizing(key: string): Record<string, number> {
  return readPreference(key, (value) => isRecord(value) && Object.values(value).every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry > 0) ? value as Record<string, number> : undefined, {});
}

export function saveTablePreference(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Keep the current page usable without persistence. */ }
}

export interface PageCursor {
  pageNumber: number;
  pageSize: number;
  scope: string;
  firstID: number;
  lastID: number;
  totalCount: number;
}

export function getPageCursorParams(cursor: PageCursor | null, pageNumber: number, pageSize: number, scope: string): { cursor?: number; cursor_direction?: string; total_count?: number } {
  if (!cursor || cursor.pageSize !== pageSize || cursor.scope !== scope) return {};
  const direction = pageNumber - cursor.pageNumber;
  if (Math.abs(direction) !== 1) return {};
  const id = direction > 0 ? cursor.lastID : cursor.firstID;
  return id >= 0 ? { cursor: id, cursor_direction: direction > 0 ? 'next' : 'prev', total_count: cursor.totalCount } : {};
}
