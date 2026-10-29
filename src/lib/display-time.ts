import moment from 'moment-timezone';

export { default as moment } from 'moment-timezone';
export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';
export const TIME_SETTINGS_KEY = 'smartdns-webui:time-display:v1';
export const DATE_TIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
export interface TimeSettings { timeZone: string; statisticsTimeZone: string }
export const DEFAULT_TIME_SETTINGS: TimeSettings = { timeZone: DEFAULT_TIME_ZONE, statisticsTimeZone: DEFAULT_TIME_ZONE };

export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || ['system', 'default'].includes(value)) return false;
  return moment.tz.zone(value) !== null;
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
export function statisticsTime(value: string, sourceZone: string): moment.Moment {
  return moment.tz(value, moment.ISO_8601, true, sourceZone);
}

export function nextStatisticsDay(value: string, sourceZone: string): number {
  return statisticsTime(value, sourceZone).add(1, 'day').startOf('day').valueOf();
}

export function formatDisplayTime(value: number | string | Date, timeZone: string, format = DATE_TIME_FORMAT): string {
  try {
    if (typeof value === 'number' && format === DATE_TIME_FORMAT) {
      const instant = new Date(value).getTime();
      if (!Number.isFinite(instant)) return '—';
      const zone = moment.tz.zone(timeZone);
      if (zone) {
        // Keep the bundled IANA rules, while avoiding a Moment object and its
        // general format parser for each numeric timestamp in a table cell.
        const local = new Date(instant - zone.utcOffset(instant) * 60000);
        const year = local.getUTCFullYear();
        if (year >= 0 && year <= 9999) {
          const two = (part: number) => String(part).padStart(2, '0');
          return `${String(year).padStart(4, '0')}/${two(local.getUTCMonth() + 1)}/${two(local.getUTCDate())} ${two(local.getUTCHours())}:${two(local.getUTCMinutes())}:${two(local.getUTCSeconds())}`;
        }
      }
    }
    // Use bundled IANA rules: Change Timezone overrides even explicitly supplied
    // Intl.DateTimeFormat zones. Numeric API timestamps must keep their instant.
    const parsed = typeof value === 'string' ? statisticsTime(value, timeZone) : moment.utc(value).tz(timeZone);
    return parsed.isValid() ? parsed.locale('en').format(format) : '—';
  } catch { return '—'; }
}

// Date-picker values contain an instant and an explicit timezone. Do not parse
// their wall-clock text again using the browser's timezone.
export function filterTimestamp(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = moment.isMoment(value) ? value : typeof value === 'number' ? moment.utc(value)
    : typeof value === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? moment.parseZone(value, moment.ISO_8601, true) : undefined;
  return parsed?.isValid() ? parsed.valueOf() : undefined;
}
