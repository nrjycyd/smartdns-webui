import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/dashboard/layout/column-widths.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { fitColumnWidths, measureColumnContent } = exports;
const columns = [
  { id: 'domain', min: 160, preferred: 400, max: 700, weight: 3 },
  { id: 'count', min: 90, preferred: 120, max: 180, weight: 1 },
  { id: 'actions', min: 90, preferred: 90, max: 90, weight: 0 },
];
const sum = (widths) => Object.values(widths).reduce((total, width) => total + width, 0);

test('available space is fitted exactly without overflowing from rounding', () => {
  for (const budget of [340, 341, 481, 610, 611, 800, 950]) {
    const widths = fitColumnWidths(columns, budget);
    assert.equal(sum(widths), budget);
    for (const column of columns) {
      assert(Number.isInteger(widths[column.id]));
      assert(widths[column.id] >= column.min && widths[column.id] <= column.max);
    }
  }
});

test('narrow screens keep readable minimums and fixed action widths', () => {
  assert.deepEqual(fitColumnWidths(columns, 200), { domain: 160, count: 90, actions: 90 });
});

test('long-text columns receive more spare space and short columns stop at their caps', () => {
  const widths = fitColumnWidths(columns, 800);
  assert(widths.domain - 400 > widths.count - 120);
  assert.deepEqual(fitColumnWidths(columns, 1400), { domain: 700, count: 180, actions: 90 });
});

test('hiding columns redistributes space only among remaining columns', () => {
  const widths = fitColumnWidths(columns.filter((column) => column.id !== 'count'), 700);
  assert.equal(sum(widths), 700);
  assert.equal(widths.count, undefined);
  assert.equal(widths.actions, 90);
  assert.deepEqual(fitColumnWidths([], 700), {});
});

test('fitting does not mutate the caller column targets', () => {
  const source = JSON.stringify(columns);
  fitColumnWidths(columns, 801);
  assert.equal(JSON.stringify(columns), source);
});

test('IPv6 does not enlarge IP columns or affect other allocated widths', () => {
  const measure = (value) => value.length * 8;
  for (const id of ['client', 'client_ip', 'ip']) {
    const before = measureColumnContent(id, ['10.0.0.6', '192.0.2.100'], measure);
    const after = measureColumnContent(id, ['10.0.0.6', '192.0.2.100', 'fd66:911f:3a47:0:6cb4:81b9:9bb9:e1b'], measure);
    assert.equal(after, before);
    const targets = (content) => [{ id, min: 140, preferred: Math.max(140, content + 40), max: 300, weight: 1 }, columns[0]];
    assert.deepEqual(fitColumnWidths(targets(after), 700), fitColumnWidths(targets(before), 700));
  }
});

test('IPv6-only pages use the same empty-sample fallback including common address formats', () => {
  const measured = [];
  const values = ['::1', '2001:DB8::1', '::ffff:192.0.2.1', 'fe80::1%eth0', '[fe80::1%25eth0]', '[2001:db8::1]:6080'];
  assert.equal(measureColumnContent('client_ip', values, (value) => { measured.push(value); return value.length; }), 0);
  assert.deepEqual(measured, []);
  assert.equal(measureColumnContent('client_ip', [], (value) => value.length), 0);
});

test('IPv4 values and colon-containing non-IP content still participate in sizing', () => {
  const measure = (value) => value.length;
  assert.equal(measureColumnContent('client', ['255.255.255.255'], measure), 15);
  assert.equal(measureColumnContent('hostname', ['2001:db8::1'], measure), 11);
  assert.equal(measureColumnContent('domain', ['proxy:server'], measure), 12);
  assert.equal(measureColumnContent('ip', ['proxy:53'], measure), 8);
});
