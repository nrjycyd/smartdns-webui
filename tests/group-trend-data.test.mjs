import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/dashboard/overview/group-trend-data.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { createGroupCountClient, groupCountQuery } = exports;
const tick = () => new Promise(resolve => setImmediate(resolve));

test('group count requests use exact nonoverlapping bounds without cursor or supplied totals', () => {
  const first = groupCountQuery('PROXY', { start: 1000, end: 2000 });
  const second = groupCountQuery('PROXY', { start: 2000, end: 3000 });
  assert.deepEqual(first, { page_num: 1, page_size: 1, domain_group: 'PROXY', timestamp_after: 1000, timestamp_before: 1999 });
  assert.equal(second.timestamp_after, first.timestamp_before + 1);
  assert.throws(() => groupCountQuery('PROXY', { start: 2, end: 2 }));
});

test('one client shares a two-request concurrency ceiling across hourly and daily jobs', async () => {
  let active = 0, maximum = 0;
  const releases = [];
  const client = createGroupCountClient(async () => {
    active++; maximum = Math.max(active, maximum);
    await new Promise(resolve => releases.push(resolve));
    active--; return 17;
  });
  const signal = new AbortController().signal;
  const jobs = Array.from({length: 8}, (_, i) => client.get(i < 4 ? 'PROXY' : 'DIRECT', { start: i * 1000, end: i * 1000 + 999 }, signal));
  await tick();
  assert.equal(releases.length, 2);
  while(releases.length > 0) { releases.shift()(); await tick(); }
  assert.deepEqual(await Promise.all(jobs), Array(8).fill(17));
  assert.equal(maximum, 2);
});

test('completed results are cached by exact group and range; forced refresh bypasses the cache', async () => {
  let calls = 0;
  const client = createGroupCountClient(async () => ++calls);
  const signal = new AbortController().signal;
  const bucket = { start: 1000, end: 2000 };
  assert.equal(await client.get('PROXY', bucket, signal), 1);
  assert.equal(await client.get('PROXY', bucket, signal), 1);
  assert.equal(await client.get('DIRECT', bucket, signal), 2);
  assert.equal(await client.get('PROXY', { ...bucket, end: 2001 }, signal), 3);
  assert.equal(await client.get('PROXY', bucket, signal, true), 4);
});

test('expired cache entries are queried again', async () => {
  let calls = 0;
  const client = createGroupCountClient(async () => ++calls, -1);
  const signal = new AbortController().signal;
  assert.equal(await client.get('PROXY', { start: 1, end: 2 }, signal), 1);
  assert.equal(await client.get('PROXY', { start: 1, end: 2 }, signal), 2);
});

test('abort removes queued jobs, aborts in-flight reads and never caches partial results', async () => {
  let calls = 0;
  const client = createGroupCountClient((_query, signal) => {
    calls++;
    return new Promise((_resolve,reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError')), {once:true}));
  });
  const controller = new AbortController();
  const jobs = Array.from({length: 7}, (_, i) => client.get('PROXY', { start: i, end: i+1 }, controller.signal));
  const settled = Promise.allSettled(jobs);
  await tick(); controller.abort();
  assert((await settled).every(result => result.status === 'rejected'));
  await tick(); assert.equal(calls,2);
});

test('failures and invalid counts reject instead of fabricating zero; a real zero is valid', async () => {
  for(const count of [NaN, -1, 1.2, undefined]) {
    const client = createGroupCountClient(async () => count);
    await assert.rejects(client.get('PROXY', { start: 1, end: 2 }, new AbortController().signal));
  }
  const client = createGroupCountClient(async () => 0);
  assert.equal(await client.get('__proto__', { start: 1, end: 2 }, new AbortController().signal), 0);
});
