import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(name) {
  const source = await readFile(new URL(`../src/components/dashboard/layout/${name}.ts`, import.meta.url), 'utf8');
  const exports = {};
  new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports);
  return exports;
}
const { queryLogColumnTarget, mergeQueryLogWidths } = await load('query-log-layout');
const { fitColumnWidths } = await load('column-widths');
const target = (id, min) => ({ id, min, preferred: min, max: min, weight: 0 });

test('short columns use stable eight-pixel steps while protecting larger content', () => {
  for (const [id, size] of [['query_time', 61], ['id', 91], ['client', 113], ['timestamp', 163]]) {
    const result = queryLogColumnTarget(target(id, size));
    assert(result.min >= size);
    assert.equal(result.min % 8, 0);
    assert.equal(result.min, result.max);
  }
  assert.equal(queryLogColumnTarget(target('query_time', 213)).min, 216);
});

test('the domain absorbs the entire desktop surplus without stretching status or numeric columns', () => {
  const targets = [queryLogColumnTarget(target('domain', 180)), queryLogColumnTarget(target('query_time', 65)), queryLogColumnTarget(target('is_cached', 60))];
  const widths = fitColumnWidths(targets, 2100);
  assert.equal(widths.query_time, 80);
  assert.equal(widths.is_cached, 80);
  assert.equal(widths.domain, 1940);
});

test('refresh retains expanded widths and allows subsequent growth without changing inputs', () => {
  const previous = { query_time: 144, client: 280 };
  const next = { query_time: 80, client: 120 };
  assert.deepEqual(mergeQueryLogWidths(previous, next), previous);
  assert.deepEqual(mergeQueryLogWidths(previous, { query_time: 168 }), { query_time: 168 });
  assert.deepEqual(next, { query_time: 80, client: 120 });
  assert.equal(queryLogColumnTarget(target('query_time', 70), 16, 144).min, 144);
  assert.equal(queryLogColumnTarget(target('query_time', 70)).min, 80);
});

test('narrow screens preserve complete numeric values and let the table scroll', () => {
  const targets = [queryLogColumnTarget(target('domain', 180)), queryLogColumnTarget(target('timestamp', 164)), queryLogColumnTarget(target('query_time', 216))];
  const widths = fitColumnWidths(targets, 300);
  assert.equal(widths.timestamp, 168);
  assert.equal(widths.query_time, 216);
  assert(Object.values(widths).reduce((sum, width) => sum + width, 0) > 300);
});
