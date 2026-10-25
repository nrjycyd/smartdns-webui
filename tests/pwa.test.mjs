import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const publicUrl = new URL('../public/', import.meta.url);
const source = await readFile(new URL('sw.js', publicUrl), 'utf8');

function worker() {
  const handlers = {};
  const entries = new Map();
  const deleted = [];
  const network = new Response('online');
  const cache = {
    add: async (request) => entries.set(new URL(request.url).pathname, new Response('offline')),
    match: async (path) => entries.get(path)?.clone(),
  };
  let fail = false;
  vm.runInNewContext(source, {
    URL, Response,
    Request: class extends Request {
      constructor(url, options) { super(new URL(url, 'https://smartdns.test'), options); }
    },
    self: {
      location: { origin: 'https://smartdns.test' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => cache,
      keys: async () => ['smartdns-offline-v0', 'smartdns-offline-v1', 'another-app'],
      delete: async (key) => { deleted.push(key); },
    },
    fetch: async () => {
      if (fail) throw new TypeError('offline');
      return network.clone();
    },
  });
  return {
    entries, deleted,
    offline: () => { fail = true; },
    lifecycle: (name) => {
      let result;
      handlers[name]({ waitUntil: (promise) => { result = promise; } });
      return result;
    },
    fetch: (path, options = {}) => {
      let result;
      handlers.fetch({
        request: { method: 'GET', mode: 'navigate', url: new URL(path, 'https://smartdns.test').href, ...options },
        respondWith: (promise) => { result = promise; },
      });
      return result;
    },
  };
}

test('manifest declares standalone mode and correctly sized PNG icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', publicUrl), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  for (const size of ['192x192', '512x512']) {
    assert.ok(manifest.icons.some((icon) => icon.sizes === size && icon.purpose === 'any'));
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon-v2.png', sizes: '180x180' }]) {
    const bytes = await readFile(new URL(`.${icon.src}`, publicUrl));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
  }
});

test('install caches only offline page and activation deletes only older owned caches', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.deepEqual([...sw.entries.keys()], ['/offline.html']);
  await sw.lifecycle('activate');
  assert.deepEqual(sw.deleted, ['smartdns-offline-v0']);
});

test('online management navigation stays live; offline navigation gets public fallback', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.equal(await (await sw.fetch('/dashboard/settings')).text(), 'online');
  assert.deepEqual([...sw.entries.keys()], ['/offline.html']);
  sw.offline();
  assert.equal(await (await sw.fetch('/dashboard/settings')).text(), 'offline');
});

test('API, static assets, Next.js requests, mutations and other origins are not intercepted', () => {
  const sw = worker();
  for (const path of ['/api', '/api/login', '/api/query/log', 'https://other.test/dashboard']) {
    assert.equal(sw.fetch(path), undefined);
  }
  assert.equal(sw.fetch('/_next/static/chunk.js', { mode: 'cors' }), undefined);
  assert.equal(sw.fetch('/dashboard?_rsc=123', { mode: 'cors' }), undefined);
  assert.equal(sw.fetch('/dashboard', { method: 'POST' }), undefined);
});
