export const CLIENT_ACTIVITY_WINDOW = 5 * 60 * 1000;
export const CLIENT_REFRESH_INTERVAL = 30_000;
export type ClientActivity = 'active' | 'inactive' | 'unknown';

export function getClientActivity(timestamp: number, now: number, available = true): ClientActivity {
  if (!available || !Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(now) || now <= 0 || timestamp > now) return 'unknown';
  return now - timestamp <= CLIENT_ACTIVITY_WINDOW ? 'active' : 'inactive';
}
