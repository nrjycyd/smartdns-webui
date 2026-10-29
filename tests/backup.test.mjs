import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('exports', 'require', source)(exports, name => name.startsWith('.') ? (name.endsWith('.json') ? JSON.parse(readFileSync(path.resolve(path.dirname(file), name), 'utf8')) : load(path.resolve(path.dirname(file), `${name}.ts`))) : require(name));
  return exports;
}
const { BACKUP_KEYS, exportBackup, parseBackup, restoreBackup } = load(fileURLToPath(new URL('../src/components/dashboard/settings/backup-data.ts', import.meta.url)));
const namesKey = 'smartdns-webui:client-names:v1';
const groupKey = 'smartdns-webui:group-appearance:v1';
const densityKey = 'smartdns-webui:table-density:v1';
function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const wrap = settings => JSON.stringify({ format: 'smartdns-webui-settings', version: 1, settings });

test('backup round trip preserves names, hidden icons, colors, group clears and preferences without credentials', () => {
  const source = storage({
    [namesKey]: JSON.stringify({ version: 1, names: { 'AA:BB:CC:DD:EE:02': '手机' }, icons: { 'AA:BB:CC:DD:EE:02': '' }, iconColors: { 'AA:BB:CC:DD:EE:02': '#123456' } }),
    [groupKey]: JSON.stringify({ version: 1, groups: { DIRECT: { icon: '', color: '#123456' } } }),
    [densityKey]: 'compact', 'custom-auth-token': 'secret', 'side-nav-visibility': 'private',
  });
  const json = exportBackup(source);
  assert(!json.includes('secret')); assert(!json.includes('private'));
  const target = storage({ 'custom-auth-token': 'keep', [densityKey]: 'spacious' });
  restoreBackup(target, parseBackup(json));
  for (const key of BACKUP_KEYS) assert.equal(target.getItem(key), source.getItem(key));
  assert.equal(target.getItem('custom-auth-token'), 'keep');
});

test('partial import touches only listed keys and null explicitly restores defaults', () => {
  const target = storage({ [densityKey]: 'compact', 'user-color-scheme': 'dark' });
  restoreBackup(target, parseBackup(wrap({ [densityKey]: null })));
  assert.equal(target.getItem(densityKey), null);
  assert.equal(target.getItem('user-color-scheme'), 'dark');
});

test('legacy group backup is accepted without altering unrelated preferences', () => {
  const backup = parseBackup('{"version":1,"groups":{"DIRECT":{"icon":"","color":"red"}}}');
  assert.deepEqual(Object.keys(backup.settings), [groupKey]);
});

test('unsupported format, future version, unknown keys and oversized files are rejected', () => {
  for (const source of ['{}', '{', wrap({ 'custom-auth-token': 'oops' }), wrap({ '__unknown__': null }), wrap({}), wrap({ [densityKey]: 'compact' }).replace('"version":1', '"version":2'), ' '.repeat(1024 * 1024 + 1)]) assert.throws(() => parseBackup(source));
});

test('invalid names, icons, colors, timezone and table settings are rejected before writes', () => {
  for (const settings of [
    { [namesKey]: '{"version":1,"names":{"bad":"oops"}}' },
    { [namesKey]: '{"version":1,"names":{},"icons":{"AA:BB:CC:DD:EE:02":"https://icon"}}' },
    { [groupKey]: '{"groups":{"x":{"color":"invalid"}}}' },
    { 'smartdns-webui:time-display:v1': '{"timeZone":"invalid","statisticsTimeZone":"UTC"}' },
    { 'clients-table-column-sizing': '{"id":-1}' },
    { 'clients-table-column-visibility': '{"id":"yes"}' },
    { 'clients-table-pagination': '{"pageIndex":0,"pageSize":99999}' },
    { [densityKey]: 'unknown' },
  ]) assert.throws(() => parseBackup(wrap(settings), color => color !== 'invalid'));
});

test('mid-write failure restores previous values and keeps unrelated storage', () => {
  const target = storage({ [densityKey]: 'compact', 'user-color-scheme': 'dark', other: 'keep' });
  const set = target.setItem;
  target.setItem = (key, value) => { if (value === 'light') throw new Error('Quota'); return set(key, value); };
  assert.throws(() => restoreBackup(target, parseBackup(wrap({ [densityKey]: 'spacious', 'user-color-scheme': 'light' }))), /storage-failed/);
  assert.equal(target.getItem(densityKey), 'compact'); assert.equal(target.getItem('user-color-scheme'), 'dark'); assert.equal(target.getItem('other'), 'keep');
});

test('restore revalidates its input and export rejects damaged saved settings', () => {
  const target = storage({ [densityKey]: 'broken' });
  assert.throws(() => exportBackup(target));
  assert.throws(() => restoreBackup(target, { format: 'smartdns-webui-settings', version: 1, settings: { 'custom-auth-token': 'oops' } }));
});
