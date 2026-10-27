'use client';

import * as React from 'react';
import { type TrendBucket } from './group-trend-data';
import { useGroupTrendSettings } from './group-trend-provider';

export function useGroupTrends(buckets: TrendBucket[], automatic: boolean, sourceZone: string) {
  const { client, groups, ready } = useGroupTrendSettings();
  const [enabled, setEnabled] = React.useState(automatic);
  const [counts, setCounts] = React.useState<Record<string, Record<number, number>>>({});
  const [progress, setProgress] = React.useState({ completed: 0, total: 0, failed: 0, loading: false });
  const controller = React.useRef<AbortController | null>(null);
  const run = React.useCallback((force = false) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setCounts({});
    const valid = buckets.filter(bucket => bucket.end > bucket.start);
    setProgress({ completed: 0, total: valid.length * groups.length, failed: 0, loading: valid.length * groups.length > 0 });
    const jobs = valid.flatMap(bucket => groups.map(group => client.get(group, bucket, request.signal, force).then(count => {
      if (!request.signal.aborted) setCounts(previous => ({ ...previous, [group]: { ...previous[group], [bucket.start]: count } }));
    }).catch(() => {
      if (!request.signal.aborted) setProgress(previous => ({ ...previous, failed: previous.failed + 1 }));
    }).finally(() => {
      if (!request.signal.aborted) setProgress(previous => ({ ...previous, completed: previous.completed + 1 }));
    })));
    void Promise.all(jobs).finally(() => { if (!request.signal.aborted) setProgress(previous => ({ ...previous, loading: false })); });
  }, [buckets, client, groups]);
  const latestRun = React.useRef(run);
  React.useEffect(() => { latestRun.current = run; }, [run]);
  // Updating total counts every minute must not restart dozens of count queries.
  // Refresh only on user action, group/source changes, or a new hour/day bucket.
  const criteria = JSON.stringify([sourceZone, groups, buckets.map(bucket => bucket.start)]);
  React.useEffect(() => {
    if (enabled && ready) latestRun.current();
    return () => { controller.current?.abort(); };
  }, [criteria, enabled, ready, client]);
  const refresh = React.useCallback(() => { if (enabled) run(true); else setEnabled(true); }, [enabled, run]);
  const stop = React.useCallback(() => { controller.current?.abort(); setProgress(previous => ({ ...previous, loading: false })); }, []);
  return { counts, groups, enabled, ...progress, refresh, stop };
}
