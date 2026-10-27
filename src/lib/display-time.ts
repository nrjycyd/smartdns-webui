import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export { default as dayjs } from 'dayjs';
export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';
export const TIME_SETTINGS_KEY = 'smartdns-webui:time-display:v1';
export const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
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
export function statisticsTime(value: string, sourceZone: string): dayjs.Dayjs {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? dayjs.utc(value) : dayjs.tz(value, sourceZone);
}

export function nextStatisticsDay(value: string, sourceZone: string): number {
  const date = statisticsTime(value, sourceZone).tz(sourceZone).format('YYYY-MM-DD');
  const next = dayjs.utc(date).add(1, 'day').format('YYYY-MM-DD');
  return dayjs.tz(next, sourceZone).valueOf();
}

export function formatDisplayTime(value: number | string | Date, timeZone: string, format = DATE_TIME_FORMAT): string {
  try {
    const parsed = typeof value === 'string' && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
      ? dayjs.tz(value, timeZone) : dayjs.utc(value);
    return parsed.isValid() ? parsed.tz(timeZone).format(format) : '—';
  } catch { return '—'; }
}

// Date-picker values contain an instant and an explicit timezone. Do not parse
// their wall-clock text again using the browser's timezone.
export function filterTimestamp(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = dayjs.isDayjs(value) ? value : typeof value === 'number' ? dayjs.utc(value)
    : typeof value === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? dayjs.utc(value) : undefined;
  return parsed?.isValid() ? parsed.valueOf() : undefined;
}
