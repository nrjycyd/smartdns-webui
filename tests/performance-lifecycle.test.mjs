import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { LazyLog } from '@melloware/react-logviewer';
import { QueryClient, isCancelledError } from '@tanstack/react-query';
import { createTheme } from '@mui/material/styles';

async function load(file, globals = {}, dependencies = {}) {
  const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const exports = {};
  new Function('exports', 'require', ...Object.keys(globals), compiled)(exports, id => { assert(id in dependencies, id); return dependencies[id]; }, ...Object.values(globals));
  return exports;
}

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

test('table surface extraction matches full MUI themes, including pre-hydration scheme', async () => {
  const { tableBackground } = await load('components/dashboard/layout/table-background.ts');
  for (const scheme of [undefined, 'light', 'dark']) assert.equal(tableBackground(scheme), createTheme({ palette: { mode: scheme === 'dark' ? 'dark' : 'light' } }).palette.background.paper);
});

test('caller cancellation aborts the transport and rejects without a session error', async () => {
  let transport;
  let signOuts = 0;
  const { smartdnsServer } = await load('lib/backend/server.ts', { fetch: (_url, { signal }) => {
    transport = signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
  } });
  smartdnsServer.setSignOut(async () => { signOuts++; return {}; });
  const caller = new AbortController();
  const request = smartdnsServer.GetQueryLogs({ page_num: 1 }, caller.signal);
  caller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  assert(transport.aborted);
  assert.equal(signOuts, 0);
});

test('an already cancelled request never reaches fetch', async () => {
  let calls = 0;
  const { smartdnsServer } = await load('lib/backend/server.ts', { fetch: async () => { calls++; return json({}); } });
  const caller = new AbortController(); caller.abort();
  await assert.rejects(smartdnsServer.GetClients({}, caller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('completed requests release their caller abort listener', async () => {
  let transport;
  const { smartdnsServer } = await load('lib/backend/server.ts', { fetch: async (_url, { signal }) => { transport = signal; return json({ smartdns: 'fixture' }); } });
  const caller = new AbortController();
  const result = await smartdnsServer.GetVersion(caller.signal);
  caller.abort();
  assert.equal(result.data.smartdns, 'fixture');
  assert.equal(transport.aborted, false);
});

test('cancellation during a 401 error body cannot sign out the current session', async () => {
  let rejectBody;
  let signOuts = 0;
  const { smartdnsServer } = await load('lib/backend/server.ts', { fetch: async () => ({ ok: false, status: 401, headers: new Headers({ 'Content-Type': 'application/json' }), json: () => new Promise((_resolve, reject) => { rejectBody = reject; }) }) });
  smartdnsServer.setSignOut(async () => { signOuts++; return {}; });
  const caller = new AbortController(), request = smartdnsServer.GetClients({}, caller.signal);
  await flush(); caller.abort(); rejectBody(caller.signal.reason);
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(signOuts, 0);
});

test('React Query cancellation reaches HTTP without converting it to a displayed API error', async () => {
  let transport, displayedErrors = 0;
  const { smartdnsServer } = await load('lib/backend/server.ts', { fetch: (_url, { signal }) => { transport = signal; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))); } });
  const client = new QueryClient();
  const request = client.fetchQuery({ queryKey: ['cancel-fixture'], queryFn: async ({ signal }) => {
    const response = await smartdnsServer.GetClients({}, signal);
    if (response.error) displayedErrors++;
    return response.data;
  } });
  const rejected = assert.rejects(request, error => isCancelledError(error));
  await client.cancelQueries({ queryKey: ['cancel-fixture'] }); await rejected;
  assert(transport.aborted); assert.equal(displayedErrors, 0); client.clear();
});

function fakeClock() {
  let now = 0, next = 0;
  const timers = new Map();
  const add = (fn, ms, interval) => { const id = ++next; timers.set(id, { fn, at: now + ms, interval }); return id; };
  return {
    setTimeout: (fn, ms) => add(fn, ms, 0), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => add(fn, ms, ms), clearInterval: id => timers.delete(id),
    get pending() { return timers.size; },
    async advance(until) {
      for (;;) {
        const entry = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        const [id, timer] = entry; now = timer.at;
        if (timer.interval) timer.at += timer.interval; else timers.delete(id);
        timer.fn(); await flush();
      }
      now = until;
    },
  };
}

test('five minutes of fast statistics failure retains one three-second retry chain', async () => {
  const clock = fakeClock(); let calls = 0;
  const { startStatisticsPolling } = await load('components/dashboard/overview/statistics-polling.ts', clock);
  const stop = startStatisticsPolling(async () => { calls++; return false; });
  await flush(); await clock.advance(300000);
  assert.equal(calls, 101); assert.equal(clock.pending, 2);
  stop(); assert.equal(clock.pending, 0); await clock.advance(360000); assert.equal(calls, 101);
});

test('statistics retain minute cadence, avoid overlap, and start fresh after remount', async () => {
  const clock = fakeClock(); let calls = 0, finish;
  const { startStatisticsPolling } = await load('components/dashboard/overview/statistics-polling.ts', clock);
  const stop = startStatisticsPolling(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  await clock.advance(120000); assert.equal(calls, 1);
  finish(true); await flush(); await clock.advance(180000); assert.equal(calls, 2);
  stop(); finish(false); await flush(); assert.equal(clock.pending, 0);
  let remountedSignal;
  const stopAgain = startStatisticsPolling(async signal => { remountedSignal = signal; calls++; return true; });
  await flush(); assert.equal(calls, 3); assert.equal(remountedSignal.aborted, false);
  await clock.advance(240000); assert.equal(calls, 4); stopAgain(); assert(remountedSignal.aborted); assert.equal(clock.pending, 0);
});

test('statistics errors recover and resume normal minute polling without lingering retries', async () => {
  const clock = fakeClock(); let calls = 0;
  const { startStatisticsPolling } = await load('components/dashboard/overview/statistics-polling.ts', clock);
  const stop = startStatisticsPolling(async () => ++calls > 1);
  await flush(); await clock.advance(3000); assert.equal(calls, 2); assert.equal(clock.pending, 1);
  await clock.advance(60000); assert.equal(calls, 3); stop(); assert.equal(clock.pending, 0);
});

test('log tail trimming preserves complete UTF-8 lines and ANSI bytes', async () => {
  const { retainLogTail } = await load('components/dashboard/log/bounded-log.tsx', {}, { '@melloware/react-logviewer': { LazyLog } });
  const source = 'old\n中文🙂\n\u001B[31mred\u001B[0m\n';
  assert.equal(new TextDecoder().decode(retainLogTail(new TextEncoder().encode(source), 2)), '中文🙂\n\u001B[31mred\u001B[0m\n');
});

test('large and consecutive log bursts bound both searchable bytes and rendered rows to 2000', async () => {
  const { BoundedLog, LOG_LINE_LIMIT } = await load('components/dashboard/log/bounded-log.tsx', {}, { '@melloware/react-logviewer': { LazyLog } });
  const log = new BoundedLog({ external: true, follow: true });
  log.forceSearch = () => {};
  log.setState = (update, callback) => { const next = typeof update === 'function' ? update(log.state, log.props) : update; log.state = { ...log.state, ...next }; callback?.(); };
  const lines = Array.from({ length: 10000 }, (_, i) => `line-${i}`);
  log.appendLines(lines); log.appendLines(['final-1', 'final-2']);
  const expected = [...lines, 'final-1', 'final-2'].slice(-LOG_LINE_LIMIT);
  assert.equal(log.state.count, LOG_LINE_LIMIT); assert.equal(log.state.lines.size, LOG_LINE_LIMIT);
  assert.equal(log.state.scrollToIndex, LOG_LINE_LIMIT - 1);
  assert.equal(new TextDecoder().decode(log.encodedLog), expected.join('\n') + '\n');
  assert.deepEqual(log.state.lines.toArray().map(line => new TextDecoder().decode(line)), expected);
  log.clear(); assert.equal(log.state.count, 0); assert.equal(log.encodedLog.length, 0);
});
