export const CLIENT_ACTIVITY_WINDOW = 5 * 60 * 1000;
export const CLIENT_REFRESH_INTERVAL = 30_000;
export type ClientActivity = 'active' | 'inactive' | 'unknown';

export function getClientActivity(timestamp: number, now: number, available = true, observedAt = 0): ClientActivity {
  // A successful response can be newer than the periodic UI clock. Use its local
  // receipt time as a floor, never the server timestamp itself.
  const reference = Number.isFinite(observedAt) && observedAt > 0 ? Math.max(now, observedAt) : now;
  if (!available || !Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(reference) || reference <= 0 || timestamp > reference) return 'unknown';
  return reference - timestamp <= CLIENT_ACTIVITY_WINDOW ? 'active' : 'inactive';
}
