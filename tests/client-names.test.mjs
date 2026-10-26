import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/dashboard/clients/client-names.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { normalizeMac, getClientName, parseClientNames, serializeClientNames, updateClientName } = exports;

test('the same MAC uses one name across case, formatting, and different IP records', () => {
  let names = updateClientName({}, 'aa-bb-cc-dd-ee-02', '  客厅手机  ');
  assert.equal(getClientName(names, 'AA:BB:CC:DD:EE:02'), '客厅手机');
  assert.equal(getClientName(names, 'aabb.ccdd.ee02'), '客厅手机');
  names = updateClientName(names, 'aabbccddee02', 'My phone');
  assert.deepEqual(names, { 'AA:BB:CC:DD:EE:02': 'My phone' });
  assert.equal(getClientName(names, 'AA:BB:CC:DD:EE:04'), undefined);
});

test('missing, placeholder, and malformed MACs never share an alias', () => {
  for (const value of [null, undefined, '', 'N/A', '00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF', 'aa:bb-cc:dd:ee:02', 'not-a-mac', '__proto__']) {
    assert.equal(normalizeMac(value), undefined);
    assert.equal(getClientName({}, value), undefined);
  }
});

test('restoring a server hostname removes only that device override', () => {
  let names = updateClientName({}, 'AA:BB:CC:DD:EE:02', 'Phone');
  names = updateClientName(names, 'AA:BB:CC:DD:EE:04', 'Laptop');
  names = updateClientName(names, 'aa-bb-cc-dd-ee-02', ' ');
  assert.deepEqual(names, { 'AA:BB:CC:DD:EE:04': 'Laptop' });
});

test('storage contains only MAC names and round trips without changing labels', () => {
  const names = { 'AA:BB:CC:DD:EE:02': '中文 <Phone>' };
  assert.deepEqual(parseClientNames(serializeClientNames(names)), names);
  assert.deepEqual(JSON.parse(serializeClientNames(names)), { version: 1, names });
  assert.deepEqual(parseClientNames(null), {});
});

test('malformed storage and invalid names are rejected instead of overwritten', () => {
  for (const value of ['{', 'null', '[]', '{}', '{"version":2,"names":{}}', '{"version":1,"names":[]}', '{"version":1,"names":{"__proto__":"Bad"}}', '{"version":1,"names":{"AA:BB:CC:DD:EE:02":123}}']) {
    assert.throws(() => parseClientNames(value));
  }
  for (const value of ['a'.repeat(65), 'line\nbreak', 'line\tbreak', String.fromCharCode(0)]) {
    assert.throws(() => updateClientName({}, 'AA:BB:CC:DD:EE:02', value));
  }
  assert.throws(() => updateClientName({}, '00:00:00:00:00:00', 'Bad'));
});
