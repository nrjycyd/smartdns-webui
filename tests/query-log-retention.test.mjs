import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

const require = createRequire(import.meta.url);
async function load(name, dependencies) {
  const source = await readFile(new URL(`../src/components/dashboard/query-log/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', 'require', compiled)(exports, id => { assert(id in dependencies, id); return dependencies[id]; });
  return exports;
}
const { createDashboardQueryClient, trimQueryLogCache, watchQueryLogCache } = await load('query-log-cache', { '@tanstack/react-query': { QueryClient } });
const { parseQueryLogSearch } = await load('query-log-navigation', { '@/lib/display-time': { moment: require('moment-timezone') } });
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('route search parsing preserves exact timestamp instants, allowed filters and one-shot count hints', () => {
  const parsed = parseQueryLogSearch('is_blocked=true&timestamp_after=0&timestamp_before=1790000000000&total_count=123&unknown=ignored');
  assert.equal(parsed.totalCount, 123);
  assert.deepEqual(parsed.filters[0], { id: 'is_blocked', value: 'true' });
  assert.equal(parsed.filters.length, 2);
  assert.equal(parsed.filters[1].value[0].valueOf(), 0);
  assert.equal(parsed.filters[1].value[1].valueOf(), 1790000000000);
  assert.deepEqual(parseQueryLogSearch('timestamp_after=bad&total_count=-1&unknown=x'), { filters: [], totalCount: undefined });
});

test('query-log session defaults retain data without relaxing freshness or changing other queries', () => {
  const client = createDashboardQueryClient();
  const options = client.defaultQueryOptions({ queryKey: ['query-log', 1] });
  assert.equal(options.gcTime, Infinity);
  assert.equal(options.staleTime, 0);
  assert.equal(options.refetchOnMount, false);
  assert.equal(client.getQueryDefaults(['clients']).gcTime, undefined);
  client.clear();
});

test('cache pruning keeps three newest results and leaves other namespaces alone', () => {
  const client = createDashboardQueryClient();
  client.setQueryData(['table-data', 0], 'clients');
  for (let i = 0; i < 8; i++) client.setQueryData(['query-log', i], { rows: [i] }, { updatedAt: 1000 + i });
  trimQueryLogCache(client);
  assert.deepEqual(client.getQueryCache().findAll({ queryKey: ['query-log'] }).map(q => q.queryKey[1]).sort(), [5,6,7]);
  assert.equal(client.getQueryData(['table-data', 0]), 'clients');
  client.clear();
});

test('unsuccessful inactive lookups cannot accumulate under infinite retention', () => {
  const client = createDashboardQueryClient();
  for (let i = 0; i < 25; i++) {
    const query = client.getQueryCache().build(client, { queryKey: ['query-log', 'failed', i] });
    query.setState({ status: 'error', error: new Error('fixture failure') });
  }
  client.setQueryData(['query-log', 'successful-empty'], { rows: [] });
  trimQueryLogCache(client);
  assert.equal(client.getQueryCache().findAll({ queryKey: ['query-log'] }).length, 1);
  assert.deepEqual(client.getQueryData(['query-log', 'successful-empty']), { rows: [] });
  client.clear();
});

test('pruning protects observed results and trims them once they become inactive', async () => {
  const client = createDashboardQueryClient();
  for (let i = 0; i < 5; i++) client.setQueryData(['query-log', i], i, { updatedAt: 1000 + i });
  const observer = new QueryObserver(client, { queryKey: ['query-log', 0], enabled: false });
  const unsubscribe = observer.subscribe(() => {});
  trimQueryLogCache(client);
  assert.notEqual(client.getQueryData(['query-log', 0]), undefined);
  const stop = watchQueryLogCache(client);
  unsubscribe();
  client.setQueryData(['query-log', 5], 5, { updatedAt: 1005 });
  await tick();
  assert.equal(client.getQueryCache().findAll({ queryKey: ['query-log'] }).length, 3);
  assert.equal(client.getQueryData(['query-log', 0]), undefined);
  stop(); client.clear();
});

test('a stale returning result stays visible during fetch and on failure, while another query cannot reuse it', async () => {
  const client = createDashboardQueryClient();
  const key = ['query-log', { filters: [], page: 0, size: 10 }];
  client.setQueryData(key, { rows: ['old'] }, { updatedAt: Date.now() - 900000 });
  let finish;
  const observer = new QueryObserver(client, { queryKey: key, queryFn: () => new Promise(resolve => { finish = resolve; }) });
  let unsubscribe = observer.subscribe(() => {});
  const refresh = observer.refetch({ cancelRefetch: false });
  await tick();
  assert.equal(observer.getCurrentResult().isLoading, false);
  assert.equal(observer.getCurrentResult().isFetching, true);
  assert.deepEqual(observer.getCurrentResult().data.rows, ['old']);
  finish({ rows: ['new'] }); await refresh; await tick(); unsubscribe();
  const failed = new QueryObserver(client, { queryKey: key, queryFn: async () => { throw new Error('fixture failure'); } });
  unsubscribe = failed.subscribe(() => {}); await failed.refetch({ cancelRefetch: false }); await tick();
  assert.equal(failed.getCurrentResult().isError, true);
  assert.deepEqual(failed.getCurrentResult().data.rows, ['new']);
  const other = new QueryObserver(client, { queryKey: ['query-log', { filters: ['blocked'], page: 0, size: 10 }], enabled: false });
  assert.equal(other.getCurrentResult().data, undefined);
  unsubscribe(); client.clear();
  assert.equal(client.getQueryData(key), undefined);
});

test('a successfully cached empty result is not initial loading on return', async () => {
  const client = createDashboardQueryClient();
  client.setQueryData(['query-log', 'empty'], { rows: [], total: 0 });
  const observer = new QueryObserver(client, { queryKey: ['query-log', 'empty'], queryFn: async () => ({ rows: [], total: 0 }) });
  const unsubscribe = observer.subscribe(() => {});
  assert.equal(observer.getCurrentResult().isLoading, false);
  assert.deepEqual(observer.getCurrentResult().data.rows, []);
  await tick(); unsubscribe(); client.clear();
});
