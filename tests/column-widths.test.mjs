import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/dashboard/layout/column-widths.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { createColumnWidthTarget, fitColumnWidths, measureColumnContent } = exports;
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


test('extra space goes to long fields while short fields keep their content widths', () => {
  const compact = [
    ['id', 84], ['client', 140], ['domain_type', 80], ['timestamp', 190], ['ping_time', 100],
    ['domain_group', 130], ['is_blocked', 90], ['is_cached', 72], ['query_time', 92],
    ['reply_code', 80], ['port', 80], ['server_type', 80], ['security', 90],
    ['status', 80], ['query_success_rate', 110], ['avg_time', 100],
    ['total_query_count', 130], ['total_query_success', 140], ['mac', 170],
  ];
  for (const [id, min] of compact) {
    const targets = [createColumnWidthTarget('query-log', id, min, min + 50), createColumnWidthTarget('query-log', 'domain', 180, 240)];
    const fitted = fitColumnWidths(targets, min + 500);
    assert.equal(fitted[id], min, `${id} must not absorb spare width`);
    assert.equal(fitted.domain, 500);
  }
});

test('query client width stays compact while spare space favors the domain', () => {
  const targets = [createColumnWidthTarget('query-log', 'domain', 180, 200), createColumnWidthTarget('query-log', 'client', 140, 140)];
  const fitted = fitColumnWidths(targets, 500);
  assert(fitted.domain - 200 > fitted.client - 140);
  assert.deepEqual(fitColumnWidths(targets, 1000), { domain: 560, client: 140 });
  assert.equal(fitColumnWidths([createColumnWidthTarget('clients', 'hostname', 160, 200, 350)], 800).hostname, 350);
});

test('larger short-field content expands its protected width without clipping on narrow screens', () => {
  const targets = [createColumnWidthTarget('query-log', 'query_time', 180, 196), createColumnWidthTarget('query-log', 'timestamp', 240, 256)];
  assert.deepEqual(fitColumnWidths(targets, 300), { query_time: 180, timestamp: 240 });
  assert.deepEqual(fitColumnWidths(targets, 1000), { query_time: 180, timestamp: 240 });
});


test('client layout gives IPv6 and device identity their own budgets', () => {
  const measure = (value) => value.length * 8;
  const values = ['fd66:911f:3a47:0:e167:7d3:e6d0:ba4a'];
  assert.equal(measureColumnContent('client_ip', values, measure), 0);
  assert(measureColumnContent('client_ip', values, measure, true) > 220);
  const targets = [
    createColumnWidthTarget('clients', 'client_ip', 340, 360),
    createColumnWidthTarget('clients', 'hostname', 160, 180),
    createColumnWidthTarget('clients', 'mac', 170, 180),
    createColumnWidthTarget('clients', 'last_query_timestamp', 200, 210),
  ];
  const fitted = fitColumnWidths(targets, 1400);
  assert(fitted.client_ip >= 340 && fitted.client_ip <= 520);
  assert(fitted.hostname <= 360);
  assert(fitted.mac >= 170);
  assert(fitted.last_query_timestamp >= 200);
  assert(fitted.hostname < fitted.client_ip);
});

test('upstream layout shares spare width with statistics and bounds host/address columns', () => {
  const fields = [['host', 160], ['ip', 140], ['port', 80], ['server_type', 80], ['security', 100], ['status', 80], ['query_success_rate', 120], ['avg_time', 120], ['total_query_count', 140], ['total_query_success', 140]];
  const targets = fields.map(([id, min]) => createColumnWidthTarget('upstream-servers', id, min, min + 16));
  const fitted = fitColumnWidths(targets, 1600);
  assert(fitted.host <= 320 && fitted.ip <= 320);
  assert.equal(fitted.port, 80);
  assert(fitted.total_query_count > 140);
  assert(fitted.total_query_success > 140);
  assert(Object.values(fitted).reduce((sum, width) => sum + width, 0) >= 1590);
  for (const [id, min] of fields) assert(fitted[id] >= min);
});
