import { DateTime } from 'luxon';

export { DateTime } from 'luxon';
export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';
export const TIME_SETTINGS_KEY = 'smartdns-webui:time-display:v1';
export const DATE_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
export interface TimeSettings { timeZone: string; statisticsTimeZone: string }
export const DEFAULT_TIME_SETTINGS: TimeSettings = { timeZone: DEFAULT_TIME_ZONE, statisticsTimeZone: DEFAULT_TIME_ZONE };

export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || ['system', 'default'].includes(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; } catch { return false; }
}

export function parseTimeSettings(raw: string | null): TimeSettings {
  try {
    const value = JSON.parse(raw ?? 'null') as Partial<TimeSettings> | null;
    return {
      timeZone: validTimeZone(value?.timeZone) ? value.timeZone : DEFAULT_TIME_ZONE,
      statisticsTimeZone: validTimeZone(value?.statisticsTimeZone) ? value.statisticsTimeZone : DEFAULT_TIME_ZONE,
    };
  } catch { return { ...DEFAULT_TIME_SETTINGS }; }
}

// Numeric API timestamps are milliseconds. Offset-bearing strings preserve the
// same instant; timezone-less chart buckets require their explicit source zone.
export function statisticsTime(value: string, sourceZone: string): DateTime {
  const options = { zone: sourceZone };
  const iso = DateTime.fromISO(value, options);
  return iso.isValid ? iso : DateTime.fromSQL(value, options);
}

export function nextStatisticsDay(value: string, sourceZone: string): number {
  return statisticsTime(value, sourceZone).setZone(sourceZone).plus({ days: 1 }).startOf('day').toMillis();
}

export function formatDisplayTime(value: number | string | Date, timeZone: string, format = DATE_TIME_FORMAT): string {
  try {
    // Use explicit IANA zones throughout. Native Date.toLocaleString() can be
    // overridden by timezone extensions, even when passed an explicit zone.
    const parsed = typeof value === 'number' ? DateTime.fromMillis(value, { zone: timeZone })
      : typeof value === 'string' ? statisticsTime(value, timeZone) : DateTime.fromJSDate(value, { zone: timeZone });
    return parsed.isValid ? parsed.setZone(timeZone).toFormat(format, { locale: 'en', numberingSystem: 'latn' }) : '—';
  } catch { return '—'; }
}

// Date-picker values contain an instant and an explicit timezone. Do not parse
// their wall-clock text again using the browser's timezone.
export function filterTimestamp(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = DateTime.isDateTime(value) ? value : typeof value === 'number' ? DateTime.fromMillis(value, { zone: 'UTC' })
    : typeof value === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? DateTime.fromISO(value, { zone: 'UTC' }) : undefined;
  return parsed?.isValid ? parsed.toMillis() : undefined;
}
