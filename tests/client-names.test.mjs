import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/dashboard/clients/client-names.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { normalizeMac, getClientName, parseClientNames, serializeClientNames, updateClientName, parseClientIcons, updateClientIcon } = exports;
const { parseClientIconColors, updateClientIconColor } = exports;

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

test('old name-only storage upgrades without losing labels; icon-only devices need no alias', () => {
  const old = serializeClientNames({ 'AA:BB:CC:DD:EE:02': 'Existing name' });
  assert.deepEqual(parseClientIcons(old), {});
  const icons = updateClientIcon({}, 'aa-bb-cc-dd-ee-04', 'mdi:devices');
  const next = serializeClientNames(parseClientNames(old), icons);
  assert.deepEqual(parseClientNames(next), { 'AA:BB:CC:DD:EE:02': 'Existing name' });
  assert.equal(getClientName(parseClientIcons(next), 'aabb.ccdd.ee04'), 'mdi:devices');
  assert.equal(getClientName(parseClientNames(next), 'aabb.ccdd.ee04'), undefined);
});

test('no icon, default icon, and restoring a name preserve independent preferences', () => {
  const mac = 'AA:BB:CC:DD:EE:02';
  let icons = updateClientIcon({}, mac, 'cbi:apple');
  let source = serializeClientNames(updateClientName({ [mac]: 'Phone' }, mac, ''), icons);
  assert.deepEqual(parseClientNames(source), {});
  assert.equal(getClientName(parseClientIcons(source), mac), 'cbi:apple');
  icons = updateClientIcon(icons, mac, '');
  source = serializeClientNames({}, icons);
  assert.equal(getClientName(parseClientIcons(source), mac), '');
  assert.deepEqual(updateClientIcon(icons, mac, undefined), {});
});

test('invalid icon storage and non-Iconify identifiers are rejected before saving', () => {
  for (const icon of ['https://example.com/icon.svg', '@evil:mdi:home', '<svg/>', 'mdi:HOME', 'mdi:home\n', 'mdi:' + 'x'.repeat(130)]) {
    assert.throws(() => updateClientIcon({}, 'AA:BB:CC:DD:EE:02', icon));
  }
  for (const icons of [null, [], 'bad', { '__bad__': 'mdi:devices' }, { 'AA:BB:CC:DD:EE:02': 123 }]) {
    assert.throws(() => parseClientIcons(JSON.stringify({ version: 1, names: {}, icons })));
  }
});

test('custom colors share normalized MACs and round trip with existing names and icons', () => {
  const mac = 'AA:BB:CC:DD:EE:02';
  const colors = updateClientIconColor({}, 'aa-bb-cc-dd-ee-02', '#a84250');
  const source = serializeClientNames({ [mac]: 'NAS' }, { [mac]: 'cbi:unraid' }, colors);
  assert.deepEqual(parseClientIconColors(source), { [mac]: '#A84250' });
  assert.equal(getClientName(parseClientNames(source), mac), 'NAS');
  assert.equal(getClientName(parseClientIcons(source), mac), 'cbi:unraid');
  assert.deepEqual(parseClientIconColors(serializeClientNames({}, {})), {});
  assert.deepEqual(parseClientIconColors(null), {});
  assert.deepEqual(updateClientIconColor(colors, mac, undefined), {});
  assert.equal(JSON.parse(serializeClientNames({}, {}, {})).iconColors, undefined);
});

test('invalid color records are rejected so broken preferences cannot be overwritten', () => {
  const mac = 'AA:BB:CC:DD:EE:02';
  for (const value of ['', 'red', '#123', '#12345678', '#12345z', 'url(x)', '#123456\n']) {
    assert.throws(() => updateClientIconColor({}, mac, value));
    assert.throws(() => parseClientIconColors(JSON.stringify({ version: 1, names: {}, iconColors: { [mac]: value } })));
  }
  for (const iconColors of [null, [], 'bad', { bad: '#123456' }, { [mac]: 123 }]) {
    assert.throws(() => parseClientIconColors(JSON.stringify({ version: 1, names: {}, iconColors })));
  }
});
