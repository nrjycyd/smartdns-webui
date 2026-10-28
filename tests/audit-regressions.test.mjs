import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

async function load(file, globals = {}, dependencies = {}) {
  const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', 'require', ...Object.keys(globals), compiled)(exports, (id) => {
    assert(id in dependencies, id);
    return dependencies[id];
  }, ...Object.values(globals));
  return exports;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('numeric zero and false query filters are preserved', async () => {
  let url;
  const { smartdnsServer } = await load('lib/backend/server.ts', { fetch: async (value) => { url = value; return json({}); } });
  await smartdnsServer.GetQueryLogs({ reply_code: 0, is_blocked: false, is_cached: false });
  const params = new URL(url, 'http://localhost').searchParams;
  assert.equal(params.get('reply_code'), '0');
  assert.equal(params.get('is_blocked'), 'false');
  assert.equal(params.get('is_cached'), 'false');
});

test('401 invalidates the session even when its JSON error body is malformed or empty', async () => {
  for (const body of ['broken-json', '', 'null']) {
    let signOuts = 0;
    const { smartdnsServer, AuthorError } = await load('lib/backend/server.ts', { fetch: async () => new Response(body, { status: 401, headers: { 'Content-Type': 'application/json' } }) });
    smartdnsServer.setSignOut(async () => { signOuts++; return {}; });
    const result = await smartdnsServer.GetClients({});
    assert(result.error instanceof AuthorError);
    assert.equal(signOuts, 1);
  }
});

test('API requests have a finite deadline and clear their timer', async () => {
  let expire;
  let cleared = false;
  const { smartdnsServer } = await load('lib/backend/server.ts', {
    setTimeout: (callback, duration) => { assert.equal(duration, 15000); expire = callback; return 7; },
    clearTimeout: (id) => { assert.equal(id, 7); cleared = true; },
    fetch: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
  });
  const pending = smartdnsServer.GetVersion();
  expire();
  assert((await pending).error);
  assert(cleared);
});

test('signing out an already expired server session does not produce a revocation warning', async () => {
  const { smartdnsServer } = await load('lib/backend/server.ts', { fetch: async () => new Response('expired', { status: 401 }) });
  assert.deepEqual(await smartdnsServer.Logout(), {});
});

test('settings maps retain their entries and Whois uses exactly one encoded domain parameter', async () => {
  const calls = [];
  const { smartdnsServer } = await load('lib/backend/server.ts', { fetch: async (url, options) => { calls.push({ url, ...options }); return json({}); } });
  await smartdnsServer.UpdateSettings(new Map([['enable_terminal', 'true'], ['__proto__', 'value']]));
  const body = JSON.parse(calls[0].body);
  assert.equal(body.enable_terminal, 'true');
  assert.equal(body.__proto__, 'value');
  const domain = 'a&domain=b.example#?=中文';
  await smartdnsServer.GetWhois(domain);
  const url = new URL(calls[1].url, 'http://localhost');
  assert.deepEqual([...url.searchParams], [['domain', domain]]);
  assert.equal(url.hash, '');
});

async function authFixture(overrides = {}) {
  const values = new Map();
  let intervalClears = 0;
  const backend = {
    setSignOut() {},
    Login: async () => ({ data: { expires_in: 600 } }),
    Logout: async () => ({}),
    RefreshToken: async () => ({ data: { expires_in: 600 } }),
    getErrorMessage: (error) => error instanceof Error ? error.message : error,
    ...overrides,
  };
  const { authClient } = await load('lib/auth/client.ts', {
    window: { crypto: webcrypto },
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) },
    setInterval: () => 1,
    clearInterval: () => { intervalClears++; },
  }, {
    '@/lib/default-logger': { logger: { debug() {} } },
    '../backend/server': { smartdnsServer: backend },
  });
  await authClient.signInWithPassword({ username: 'test', password: 'test' });
  return { authClient, values, intervalClears: () => intervalClears };
}

test('sign-out clears local state immediately, deduplicates revocation and reports a server failure', async () => {
  let finish;
  let calls = 0;
  const fixture = await authFixture({ Logout: () => { calls++; return new Promise((resolve) => { finish = resolve; }); } });
  const { authClient, values } = fixture;
  const events = [];
  const unsubscribe = authClient.subscribeSignOut((error) => events.push(error));
  const first = authClient.signOut();
  const second = authClient.signOut();
  assert.equal(values.has('custom-auth-token'), false);
  assert.equal((await authClient.getUser()).data, null);
  assert.equal(fixture.intervalClears(), 1);
  assert.equal(calls, 1);
  finish({ error: 'server unavailable' });
  assert.deepEqual(await first, { error: 'server unavailable' });
  assert.deepEqual(await second, { error: 'server unavailable' });
  assert.deepEqual(events, [undefined, 'server unavailable']);
  unsubscribe();
  await authClient.signOut();
  assert.equal(events.length, 2);
});

test('an in-flight refresh cannot recreate a signed-out local session', async () => {
  let finish;
  const { authClient, values } = await authFixture({ RefreshToken: () => new Promise((resolve) => { finish = resolve; }) });
  const refresh = authClient.refreshTokens();
  await authClient.signOut();
  finish({ data: { expires_in: 600 } });
  await refresh;
  assert.equal(values.has('custom-auth-token'), false);
  assert.equal((await authClient.getUser()).data, null);
});

test('a new sign-in waits until the previous server revocation finishes', async () => {
  let finish;
  let logins = 0;
  const { authClient, values } = await authFixture({
    Login: async () => { logins++; return { data: { expires_in: 600 } }; },
    Logout: () => new Promise((resolve) => { finish = resolve; }),
  });
  const signOut = authClient.signOut();
  const signIn = authClient.signInWithPassword({ username: 'next-user', password: 'test' });
  await Promise.resolve();
  assert.equal(logins, 1);
  finish({});
  await signOut;
  await signIn;
  assert.equal(logins, 2);
  assert(values.has('custom-auth-token'));
  authClient.destroy();
});

async function preferences(values = new Map(), denied = false) {
  return load('components/dashboard/layout/table-preferences.ts', { window: { localStorage: {
    getItem: (key) => { if (denied) throw new Error('denied'); return values.get(key) ?? null; },
    setItem: (key, value) => { if (denied) throw new Error('denied'); values.set(key, value); },
    removeItem: (key) => { if (denied) throw new Error('denied'); values.delete(key); },
  } } });
}

test('malformed pagination resets only its own key and keeps device names', async () => {
  for (const invalid of ['null', '[]', '{}', 'broken', '{"pageIndex":-1,"pageSize":10}', '{"pageIndex":0,"pageSize":0}', '{"pageIndex":0,"pageSize":"10"}']) {
    const stored = new Map([['pagination', invalid], ['client-names', 'preserve']]);
    const api = await preferences(stored);
    assert.deepEqual(api.readTablePagination('pagination'), { pageIndex: 0, pageSize: 10 });
    assert.equal(stored.has('pagination'), false);
    assert.equal(stored.get('client-names'), 'preserve');
  }
});

test('valid saved pagination and manual column preferences survive validation', async () => {
  const api = await preferences(new Map([
    ['pagination', '{"pageIndex":2,"pageSize":50}'],
    ['visibility', '{"id":false,"hostname":true}'],
    ['widths', '{"domain":510,"client":240}'],
  ]));
  assert.deepEqual(api.readTablePagination('pagination'), { pageIndex: 2, pageSize: 50 });
  assert.deepEqual(api.readColumnVisibility('visibility'), { id: false, hostname: true });
  assert.deepEqual(api.readColumnSizing('widths'), { domain: 510, client: 240 });
});

test('invalid column preferences and disabled browser storage do not break tables', async () => {
  const api = await preferences(new Map([['visibility', 'null'], ['widths', '{"domain":-1}']]));
  assert.deepEqual(api.readColumnVisibility('visibility'), {});
  assert.deepEqual(api.readColumnSizing('widths'), {});
  const denied = await preferences(new Map(), true);
  assert.deepEqual(denied.readTablePagination('pagination'), { pageIndex: 0, pageSize: 10 });
  assert.doesNotThrow(() => denied.saveTablePreference('widths', { domain: 100 }));
});

test('cursor optimization is scoped to adjacent pages of the same filter and page size', async () => {
  const { getPageCursorParams } = await preferences();
  const cursor = { pageNumber: 2, pageSize: 10, scope: 'filter-a', firstID: 90, lastID: 81, totalCount: 100 };
  assert.deepEqual(getPageCursorParams(cursor, 3, 10, 'filter-a'), { cursor: 81, cursor_direction: 'next', total_count: 100 });
  assert.deepEqual(getPageCursorParams(cursor, 1, 10, 'filter-a'), { cursor: 90, cursor_direction: 'prev', total_count: 100 });
  for (const [page, size, scope] of [[3, 20, 'filter-a'], [3, 10, 'filter-b'], [5, 10, 'filter-a'], [2, 10, 'filter-a']]) {
    assert.deepEqual(getPageCursorParams(cursor, page, size, scope), {});
  }
});

test('invalid local session envelopes never produce a user', async () => {
  const fixture = await authFixture();
  for (const value of [{ token: 'x' }, { token: 'x', expiresAt: 'invalid' }, { token: '', expiresAt: Date.now() + 60000 }, null, {}]) {
    fixture.values.set('custom-auth-token', JSON.stringify(value));
    assert.equal((await fixture.authClient.getUser()).data, null);
  }
});

test('metrics cleanup prevents reconnects and messages from a previous mount', async () => {
  const sockets = [], timers = new Map(); let nextTimer = 0, messages = 0, opens = 0;
  class Socket {
    constructor(url) { assert.equal(url, 'ws://test/api/stats/metrics'); sockets.push(this); }
    close() { this.closed = true; }
  }
  const { openMetricsStream } = await load('components/dashboard/overview/metrics-stream.ts', {
    WebSocket: Socket,
    setTimeout: (fn, delay) => { assert.equal(delay, 3000); timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  });
  const connect = () => openMetricsStream('ws://test/api/stats/metrics', () => opens++, () => messages++);
  const stopOld = connect(); sockets[0].onopen(); assert.equal(opens, 1);
  stopOld(); const stopNew = connect();
  sockets[0].onclose(); sockets[0].onmessage({}); sockets[0].onopen();
  assert.equal(timers.size, 0); assert.equal(messages, 0); assert.equal(opens, 1);
  sockets[1].onmessage({}); assert.equal(messages, 1);
  sockets[1].onclose(); assert.equal(timers.size, 1);
  const callback = [...timers.values()][0]; timers.clear(); callback();
  assert.equal(sockets.length, 3);
  sockets[2].onclose(); assert.equal(timers.size, 1);
  stopNew(); assert.equal(timers.size, 0); assert(sockets[2].closed);
  callback(); assert.equal(sockets.length, 3);
});

test('service worker registration requires production and a secure context without intercepting installation', async () => {
  for (const [mode, secure, expected] of [['production', true, 1], ['production', false, 0], ['development', true, 0]]) {
    let registrations = 0;
    const { ServiceWorkerRegistration } = await load('components/core/service-worker-registration.tsx', {
      process: { env: { NODE_ENV: mode } },
      window: { isSecureContext: secure, addEventListener: () => assert.fail('Browser installation must not be intercepted') },
      navigator: { serviceWorker: { register: async (url, options) => { assert.equal(url, '/sw.js'); assert.equal(options.scope, '/'); registrations++; } } },
    }, { react: { useEffect: fn => fn() } });
    assert.equal(ServiceWorkerRegistration(), null); assert.equal(registrations, expected);
  }
});
