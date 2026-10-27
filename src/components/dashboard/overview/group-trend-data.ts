export interface TrendBucket { start: number; end: number }
export interface GroupCountQuery {
  [key: string]: unknown;
  page_num: number;
  page_size: number;
  domain_group: string;
  timestamp_after: number;
  timestamp_before: number;
}

export function groupCountQuery(group: string, bucket: TrendBucket): GroupCountQuery {
  if (!group || !Number.isSafeInteger(bucket.start) || !Number.isSafeInteger(bucket.end) || bucket.end <= bucket.start) throw new Error('Invalid group count range');
  // Both API bounds are inclusive; adjacent buckets must not share a millisecond.
  return { page_num: 1, page_size: 1, domain_group: group, timestamp_after: bucket.start, timestamp_before: bucket.end - 1 };
}

export function createGroupCountClient(read: (query: GroupCountQuery, signal: AbortSignal) => Promise<number>, cacheMs = 300000) {
  const cache = new Map<string, { count: number; expires: number }>();
  const queue: (() => void)[] = [];
  let active = 0;
  const pump = () => {
    while (active < 2 && queue.length > 0) queue.shift()?.();
  };
  const get = (group: string, bucket: TrendBucket, signal: AbortSignal, force = false): Promise<number> => {
    const query = groupCountQuery(group, bucket);
    const key = JSON.stringify([group, bucket.start, bucket.end]);
    const cached = cache.get(key);
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    if (!force && cached && cached.expires > Date.now()) return Promise.resolve(cached.count);
    return new Promise((resolve, reject) => {
      const abort = () => {
        const index = queue.indexOf(run);
        if (index !== -1) queue.splice(index, 1);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const run = () => {
        if (signal.aborted) { abort(); return; }
        active++;
        void Promise.resolve().then(() => read(query, signal)).then(count => {
          if (signal.aborted) return;
          if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid group count');
          cache.delete(key);
          cache.set(key, { count, expires: Date.now() + cacheMs });
          while (cache.size > 2048) cache.delete(cache.keys().next().value!);
          resolve(count);
        }).catch(reject).finally(() => {
          signal.removeEventListener('abort', abort);
          active--;
          pump();
        });
      };
      signal.addEventListener('abort', abort, { once: true });
      queue.push(run);
      pump();
    });
  };
  return { get };
}

