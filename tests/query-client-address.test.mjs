import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/dashboard/query-log/client-address.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { formatQueryClientAddress: display } = exports;

test('long IPv6 shows exactly the final four groups and the double-colon display prefix', () => {
  assert.equal(display('fd66:911f:3a47:0:e167:7d3:e6d0:ba4a'), '::e167:7d3:e6d0:ba4a');
  assert.equal(display('FD66:911F:3A47:0:E167:7D3:E6D0:BA4A'), '::e167:7d3:e6d0:ba4a');
});

test('compressed zero groups are expanded before selecting the final four groups', () => {
  assert.equal(display('2001:db8:1234:5678:9abc::1'), '::9abc:0:0:1');
  assert.equal(display('fd66:911f:3a47::e167:7d3:e6d0:ba4a'), '::e167:7d3:e6d0:ba4a');
});

test('short IPv6, IPv4 and ordinary labels retain their original display', () => {
  for (const value of ['::', '::1', '2001:db8::1', '240e:5b::6666', '10.0.0.6', 'dns.example.test']) assert.equal(display(value), value);
  assert.equal(display(null), '');
  assert.equal(display(undefined), '');
});

test('IPv4-mapped IPv6 keeps all final address bits when abbreviated', () => {
  assert.equal(display('0:0:0:0:0:ffff:192.0.2.128'), '::0:ffff:c000:280');
  assert.equal(display('::ffff:192.0.2.128'), '::ffff:192.0.2.128');
});

test('scope identifiers remain present and invalid address-like input stays unchanged', () => {
  assert.equal(display('fe80:0:0:0:1234:5678:9abc:def0%eth0'), '::1234:5678:9abc:def0%eth0');
  for (const value of ['fe80::1%eth0', 'fd66:911f:3a47:0:e167:7d3:e6d0:zzzz', '1:2:3:4:5:6:7:8:9', '[2001:db8::1]:6080', '2001:db8:1234:5678:9abc::1%', 'fe80::1%eth0%extra']) assert.equal(display(value), value);
});

test('abbreviated labels do not mutate the source address or imply uniqueness across prefixes', () => {
  const a = { client: 'fd66:911f:3a47:0:e167:7d3:e6d0:ba4a' };
  const b = { client: '2001:db8:1234:5678:e167:7d3:e6d0:ba4a' };
  const original = a.client;
  assert.equal(display(a.client), display(b.client));
  assert.equal(a.client, original);
  assert.notEqual(a.client, b.client);
});
