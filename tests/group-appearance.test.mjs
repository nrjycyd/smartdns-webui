import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/dashboard/query-log/group-appearance.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { EMPTY_GROUP_APPEARANCES, getGroupAppearance, parseGroupAppearances, mergeGroupAppearances, parseGroupOverrides, serializeGroupOverrides, setGroupOverride, splitThemeColor, joinThemeColors } = exports;

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

test('local overrides preserve explicit empty fields and inherit only absent fields', () => {
  const defaults = parseGroupAppearances('{"groups":{"REJECT":{"color":"red","icon":"mdi:home","iconColor":"orange"}}}');
  const custom = parseGroupOverrides('{"version":1,"groups":{"REJECT":{"color":"","icon":""}}}');
  assert.deepEqual(custom.REJECT, { color: '', icon: '' });
  assert.equal(getGroupAppearance(mergeGroupAppearances(defaults, custom), 'REJECT'), undefined);
  const iconOnly = parseGroupOverrides('{"version":1,"groups":{"REJECT":{"iconColor":""}}}');
  assert.deepEqual(mergeGroupAppearances(defaults, iconOnly).REJECT, { color: 'red', icon: 'mdi:home' });
});

test('file updates reach inherited fields without undoing explicit local clears', () => {
  const custom = parseGroupOverrides('{"groups":{"REJECT":{"icon":""}}}');
  const first = parseGroupAppearances('{"groups":{"REJECT":{"color":"red","icon":"mdi:home"}}}');
  const next = parseGroupAppearances('{"groups":{"REJECT":{"color":"blue","icon":"mdi:account"}}}');
  assert.deepEqual(mergeGroupAppearances(first, custom).REJECT, { color: 'red' });
  assert.deepEqual(mergeGroupAppearances(next, custom).REJECT, { color: 'blue' });
});

test('resetting a field removes only its override and restores the file default', () => {
  let custom = setGroupOverride(EMPTY_GROUP_APPEARANCES, 'REJECT', 'color', '');
  custom = setGroupOverride(custom, 'REJECT', 'icon', 'mdi:home');
  custom = setGroupOverride(custom, 'REJECT', 'color', undefined);
  assert.deepEqual(custom, { REJECT: { icon: 'mdi:home' } });
  custom = setGroupOverride(custom, 'REJECT', 'icon', undefined);
  assert.deepEqual(custom, {});
});

test('exports contain only custom fields and preserve clears across import', () => {
  const custom = { PROXY: { iconColor: '' }, REJECT: { color: '#112233' } };
  const text = serializeGroupOverrides(custom);
  assert.deepEqual(JSON.parse(text), { version: 1, groups: { REJECT: { color: '#112233' }, PROXY: { iconColor: '' } } });
  assert.deepEqual(parseGroupOverrides(text), custom);
});

test('bad local data and unsupported versions are rejected instead of silently overwriting settings', () => {
  for (const text of ['', '{}', 'null', '[]', '{"version":2,"groups":{}}', '{"groups":{"REJECT":{"icon":"@custom:mdi:home"}}}', '{"groups":{"REJECT":{"color":7}}}']) {
    assert.throws(() => parseGroupOverrides(text));
  }
  assert.deepEqual(parseGroupOverrides('{"groups":{"REJECT":{"color":null,"icon":null}}}'), { REJECT: { color: '', icon: '' } });
});

test('prototype-like local group names remain ordinary own properties', () => {
  const custom = setGroupOverride({}, '__proto__', 'color', 'red');
  const restored = parseGroupOverrides(serializeGroupOverrides(custom));
  assert.equal(getGroupAppearance(restored, '__proto__').color, 'red');
  assert.equal({}.color, undefined);
  assert.equal(getGroupAppearance(mergeGroupAppearances({}, restored), 'toString'), undefined);
});

test('theme color editing understands nested color functions and fixed colors', () => {
  assert.deepEqual(splitThemeColor('light-dark(rgb(1, 2, 3), hsl(30, 40%, 50%))'), ['rgb(1, 2, 3)', 'hsl(30, 40%, 50%)']);
  assert.deepEqual(splitThemeColor('#112233'), ['#112233', '#112233']);
  assert.equal(joinThemeColors('#112233', '#112233'), '#112233');
  assert.equal(joinThemeColors('#112233', '#aabbcc'), 'light-dark(#112233, #aabbcc)');
});
