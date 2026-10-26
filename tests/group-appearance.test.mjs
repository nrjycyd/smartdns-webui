import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/dashboard/query-log/group-appearance.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { EMPTY_GROUP_APPEARANCES, getGroupAppearance, parseGroupAppearances } = exports;

test('empty, invalid and unrelated JSON preserve the original display', () => {
  for (const text of ['', '   ', '{', '<html>not found</html>', '{}', 'null', '[]', '{"groups":null}', '{"groups":[]}', '{"groups":{}}']) {
    assert.equal(parseGroupAppearances(text), EMPTY_GROUP_APPEARANCES);
  }
});

test('blank fields do not add colors or icons, and iconColor alone has no effect', () => {
  const parsed = parseGroupAppearances(JSON.stringify({ groups: { REJECT: { color: ' ', icon: '', iconColor: 'red' }, PROXY: { color: null, icon: false }, DIRECT: null } }));
  assert.equal(parsed, EMPTY_GROUP_APPEARANCES);
});

test('text and icon colors remain independent and trim surrounding whitespace', () => {
  const parsed = parseGroupAppearances(JSON.stringify({ groups: { REJECT: { color: ' #e53935 ', icon: ' mdi:shield-off-outline ', iconColor: ' #ff9800 ' } } }));
  assert.deepEqual(getGroupAppearance(parsed, 'REJECT'), { color: '#e53935', icon: 'mdi:shield-off-outline', iconColor: '#ff9800' });
});

test('color-only and icon-only styles preserve the corresponding default', () => {
  const parsed = parseGroupAppearances(JSON.stringify({ groups: { REJECT: { color: 'red', icon: '', iconColor: 'orange' }, PROXY: { color: '', icon: 'mdi:swap-horizontal', iconColor: '' } } }));
  assert.deepEqual(getGroupAppearance(parsed, 'REJECT'), { color: 'red', icon: undefined, iconColor: undefined });
  assert.deepEqual(getGroupAppearance(parsed, 'PROXY'), { color: undefined, icon: 'mdi:swap-horizontal', iconColor: undefined });
});

test('only exact existing group entries match; other names retain their original display', () => {
  const parsed = parseGroupAppearances('{"groups":{"REJECT":{"color":"red"},"default":{"icon":"mdi:lan-connect"}}}');
  assert.equal(getGroupAppearance(parsed, 'reject'), undefined);
  assert.equal(getGroupAppearance(parsed, 'NEW-GROUP'), undefined);
  assert.equal(getGroupAppearance(parsed, 'constructor'), undefined);
  assert.equal(getGroupAppearance(parsed, 'default').icon, 'mdi:lan-connect');
});

test('invalid names and arbitrary URLs/providers never become remote icon requests', () => {
  for (const icon of ['https://example.com/icon.svg', '@custom:mdi:home', 'javascript:alert(1)', 'mdi:../home', 'mdi:', 42]) {
    assert.equal(parseGroupAppearances(JSON.stringify({ groups: { REJECT: { icon } } })), EMPTY_GROUP_APPEARANCES);
  }
});

test('prototype-like group names are matched as ordinary own properties', () => {
  const parsed = parseGroupAppearances('{"groups":{"__proto__":{"color":"red"}}}');
  assert.equal(getGroupAppearance(parsed, '__proto__').color, 'red');
  assert.equal({}.color, undefined);
  assert.equal(getGroupAppearance(parsed, 'toString'), undefined);
});

test('default configuration refers only to shipped icon data', async () => {
  const config = await readFile(new URL('../public/group-colors.json', import.meta.url), 'utf8');
  const icons = JSON.parse(await readFile(new URL('../src/components/dashboard/query-log/group-icons.json', import.meta.url), 'utf8'));
  const parsed = parseGroupAppearances(config);
  assert.deepEqual(Object.keys(parsed), ['REJECT', 'PROXY', 'DIRECT']);
  assert.equal(parsed.REJECT.icon, 'keyline-icons:shield-off-duotone');
  assert.equal(parsed.PROXY.icon, 'andrsrxn:globe-sparkle');
  assert.equal(parsed.DIRECT.icon, 'keyline-icons:circle-zap-sharp-duotone');
  for (const group of Object.values(parsed)) {
    assert.equal(typeof icons[group.icon].body, 'string');
    assert.equal(icons[group.icon].width, 24);
  }
});

test('theme-aware CSS colors remain configurable without a new JSON field', () => {
  const parsed = parseGroupAppearances('{"groups":{"REJECT":{"color":"light-dark(#c62828, #ef9a9a)","icon":"keyline-icons:shield-off-duotone","iconColor":"light-dark(red, orange)"}}}');
  assert.equal(parsed.REJECT.color, 'light-dark(#c62828, #ef9a9a)');
  assert.equal(parsed.REJECT.iconColor, 'light-dark(red, orange)');
});
