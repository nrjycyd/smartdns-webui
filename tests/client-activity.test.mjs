import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/dashboard/clients/client-activity.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { getClientActivity } = exports;
const now = Date.UTC(2026, 9, 28, 10);

test('recent DNS activity expires at the five-minute boundary without a new request', () => {
  const timestamp = now - 300_000;
  assert.equal(getClientActivity(timestamp, now), 'active');
  assert.equal(getClientActivity(timestamp, now + 1), 'inactive');
  assert.equal(getClientActivity(now, now), 'active');
  assert.equal(getClientActivity(now - 86_400_000, now), 'inactive');
});

test('request failures, missing timestamps and clock anomalies are unknown rather than offline', () => {
  assert.equal(getClientActivity(now, now, false), 'unknown');
  for (const timestamp of [0, -1, undefined, null, NaN, Infinity, now + 1]) {
    assert.equal(getClientActivity(timestamp, now), 'unknown');
  }
  assert.equal(getClientActivity(now, 0), 'unknown');
});

test('fresh client responses use their receipt time when the periodic clock is behind', () => {
  const received = now + 20_000;
  const timestamp = received - 1;
  assert.equal(getClientActivity(timestamp, now), 'unknown');
  assert.equal(getClientActivity(timestamp, now, true, received), 'active');
  assert.equal(getClientActivity(timestamp, received + 300_000, true, received), 'inactive');
  assert.equal(getClientActivity(received - 300_000, now, true, received), 'active');
  assert.equal(getClientActivity(received - 300_001, now, true, received), 'inactive');
});

test('receipt time never disguises failed requests, missing timestamps or real future timestamps', () => {
  const received = now + 20_000;
  assert.equal(getClientActivity(received - 1, now, false, received), 'unknown');
  assert.equal(getClientActivity(received + 1, now, true, received), 'unknown');
  assert.equal(getClientActivity(0, now, true, received), 'unknown');
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.equal(getClientActivity(now - 1, now, true, invalid), 'active');
    assert.equal(getClientActivity(now + 1, now, true, invalid), 'unknown');
  }
});
