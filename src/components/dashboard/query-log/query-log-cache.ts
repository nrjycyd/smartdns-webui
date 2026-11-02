import { QueryClient } from '@tanstack/react-query';

export const QUERY_LOG_CACHE_LIMIT = 3;

export function createDashboardQueryClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  client.setQueryDefaults(['query-log'], { gcTime: Infinity, staleTime: 0, refetchOnMount: false });
  return client;
}

export function trimQueryLogCache(client: QueryClient): void {
  const queries = client.getQueryCache().findAll({ queryKey: ['query-log'] });
  for (const query of queries) {
    if (query.state.data === undefined && query.getObserversCount() === 0 && query.state.fetchStatus === 'idle') {
      client.removeQueries({ queryKey: query.queryKey, exact: true });
    }
  }
  const results = queries
    .filter(query => query.state.data !== undefined)
    .toSorted((left, right) => right.state.dataUpdatedAt - left.state.dataUpdatedAt);
  let remaining = results.length;
  for (const query of results.toReversed()) {
    if (remaining <= QUERY_LOG_CACHE_LIMIT) break;
    if (query.getObserversCount() > 0 || query.state.fetchStatus !== 'idle') continue;
    client.removeQueries({ queryKey: query.queryKey, exact: true });
    remaining--;
  }
}

export function watchQueryLogCache(client: QueryClient): () => void {
  let disposed = false, scheduled = false;
  const unsubscribe = client.getQueryCache().subscribe(event => {
    if (event.query.queryKey[0] !== 'query-log' || scheduled || event.type === 'removed') return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; if (!disposed) trimQueryLogCache(client); });
  });
  return () => { disposed = true; unsubscribe(); };
}
