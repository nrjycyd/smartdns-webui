import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(name, dependencies = {}) {
  const source = await readFile(new URL(`../src/components/dashboard/clients/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', 'require', compiled)(exports, (id) => { assert(id in dependencies); return dependencies[id]; });
  return exports;
}
const namesModule = await load('client-names');
const { getClientIdentity, getClientDeviceIdentity, normalizeClientIp } = await load('client-identity', { './client-names': namesModule });
const names = { 'E2:AE:64:F7:3E:EE': 'Samsung-S22' };
const ipv6 = 'fd66:911f:3a47:0:e167:7d3:e6d0:ba4a';

test('IPv4 and IPv6 for the same MAC resolve to the same custom name', () => {
  for (const ip of ['10.0.0.6', ipv6]) {
    const identity = getClientIdentity(ip, names, { client_ip: ip, mac: 'e2-ae-64-f7-3e-ee' });
    assert.equal(identity.name, 'Samsung-S22');
    assert.equal(identity.tooltip, `Samsung-S22 · ${ip}`);
  }
});

test('equivalent IPv6 spellings match while the tooltip retains the exact original IP', () => {
  const ip = 'FD66:911F:3A47:0:E167:7D3:E6D0:BA4A';
  assert.equal(normalizeClientIp(ip), normalizeClientIp('fd66:911f:3a47::e167:7d3:e6d0:ba4a'));
  assert.equal(getClientIdentity(ip, names, { client_ip: ipv6, mac: 'e2:ae:64:f7:3e:ee' }).tooltip, `Samsung-S22 · ${ip}`);
});

test('unmatched IPs never inherit another device name', () => {
  assert.deepEqual(getClientIdentity('10.0.0.7', names, { client_ip: '10.0.0.6', mac: 'e2:ae:64:f7:3e:ee' }), { name: undefined, tooltip: '10.0.0.7' });
  const sameTail = '2001:db8:1234:5678:e167:7d3:e6d0:ba4a';
  assert.deepEqual(getClientIdentity(sameTail, names, { client_ip: ipv6, mac: 'e2:ae:64:f7:3e:ee' }), { name: undefined, tooltip: sameTail });
  assert.notEqual(normalizeClientIp('fe80::1%eth0'), normalizeClientIp('fe80::1%eth1'));
});

test('missing record, invalid MAC or absent custom name falls back to the original IP', () => {
  for (const client of [null, undefined, { client_ip: ipv6, mac: '00:00:00:00:00:00' }, { client_ip: ipv6, mac: '02:00:00:00:00:01', hostname: 'Server name is not a fallback' }]) {
    assert.deepEqual(getClientIdentity(ipv6, names, client), { name: undefined, tooltip: ipv6 });
  }
  assert.deepEqual(getClientIdentity(ipv6, {}, { client_ip: ipv6, mac: 'e2:ae:64:f7:3e:ee' }), { name: undefined, tooltip: ipv6 });
});

test('editing and removing a custom name updates the shared tooltip without changing IP data', () => {
  const client = { client_ip: ipv6, mac: 'e2:ae:64:f7:3e:ee' };
  assert.equal(getClientIdentity(ipv6, { ...names, 'E2:AE:64:F7:3E:EE': 'Phone' }, client).tooltip, `Phone · ${ipv6}`);
  assert.equal(getClientIdentity(ipv6, {}, client).tooltip, ipv6);
  assert.equal(client.client_ip, ipv6);
});

test('icon-only preferences resolve for both IP families without changing copied IP text', () => {
  const icons = { 'E2:AE:64:F7:3E:EE': 'cbi:apple' };
  for (const ip of ['10.0.0.6', ipv6]) {
    const result = getClientDeviceIdentity(ip, {}, icons, { client_ip: ip, mac: 'e2-ae-64-f7-3e-ee', last_query_timestamp: 12345 });
    assert.equal(result.icon, 'cbi:apple');
    assert.equal(result.name, undefined);
    assert.equal(result.tooltip, ip);
    assert.equal(result.lastQueryTimestamp, 12345);
  }
});

test('equivalent IPv6 matches icons while another IP cannot inherit an icon or activity', () => {
  const icons = { 'E2:AE:64:F7:3E:EE': 'cbi:apple' };
  const client = { client_ip: ipv6, mac: 'e2:ae:64:f7:3e:ee', last_query_timestamp: 12345 };
  assert.equal(getClientDeviceIdentity('FD66:911F:3A47::E167:7D3:E6D0:BA4A', names, icons, client).icon, 'cbi:apple');
  for (const record of [null, undefined, { ...client, client_ip: '10.0.0.7' }]) {
    assert.deepEqual(getClientDeviceIdentity('10.0.0.6', names, icons, record), { name: undefined, tooltip: '10.0.0.6', icon: undefined, customColor: undefined, lastQueryTimestamp: undefined });
  }
});

test('custom color follows the matched MAC across IPv4 and IPv6 without leaking to another IP', () => {
  const colors = { 'E2:AE:64:F7:3E:EE': '#3B7B91' };
  for (const ip of ['10.0.0.6', ipv6]) {
    const client = { client_ip: ip, mac: 'e2-ae-64-f7-3e-ee' };
    const result = getClientDeviceIdentity(ip, names, {}, client, colors);
    assert.equal(result.customColor, '#3B7B91');
    assert.equal(result.tooltip, `Samsung-S22 · ${ip}`);
    assert.equal(getClientDeviceIdentity('10.0.0.7', names, {}, client, colors).customColor, undefined);
  }
});

test('explicit no-icon and default fallback retain the existing name and copy details', () => {
  const client = { client_ip: '10.0.0.6', mac: 'e2:ae:64:f7:3e:ee' };
  const hidden = getClientDeviceIdentity('10.0.0.6', names, { 'E2:AE:64:F7:3E:EE': '' }, client);
  assert.equal(hidden.icon, '');
  assert.equal(hidden.tooltip, 'Samsung-S22 · 10.0.0.6');
  assert.equal(getClientDeviceIdentity('10.0.0.6', names, {}, client).icon, undefined);
});

const { clientSnapshotIPs, createClientSnapshot, snapshotClient, CLIENT_SNAPSHOT_LIMIT } = await load('client-snapshot', { './client-identity': { normalizeClientIp } });
test('bounded snapshots share normalized IPv6 and preserve exact records', () => {
  const entry = { client_ip: ipv6, mac: 'E2:AE:64:F7:3E:EE', last_query_timestamp: 123 };
  const snapshot = createClientSnapshot({ client_list: [entry], total_count: 1 });
  assert.equal(snapshotClient(snapshot, 'fd66:911f:3a47:0:e167:07d3:e6d0:ba4a'), entry);
  assert.equal(snapshotClient(snapshot, '192.0.2.1'), null);
});
test('a missing client in a partial snapshot requires an exact-IP fallback', () => {
  const entry = { client_ip: '192.0.2.1' };
  const snapshot = createClientSnapshot({ client_list: [entry], total_count: 1000 });
  assert.equal(snapshotClient(snapshot, entry.client_ip), entry);
  assert.equal(snapshotClient(snapshot, '192.0.2.2'), undefined);
});
test('empty complete snapshots distinguish absence from incomplete data', () => {
  assert.equal(snapshotClient(createClientSnapshot({ client_list: [], total_count: 0 }), '192.0.2.1'), null);
  assert.equal(snapshotClient(createClientSnapshot({ client_list: [], total_count: 1 }), '192.0.2.1'), undefined);
});
test('invalid or oversized snapshots are rejected so exact lookups can recover', () => {
  for (const value of [{}, { client_list: [], total_count: -1 }, { client_list: [{}], total_count: 1 }, { client_list: [{ client_ip: 'x' }], total_count: 0 }, { client_list: Array.from({ length: CLIENT_SNAPSHOT_LIMIT + 1 }, () => ({ client_ip: '192.0.2.1' })), total_count: 999 }]) {
    assert.throws(() => createClientSnapshot(value));
  }
});

test('small pages keep exact lookups and repeated IPs do not trigger a snapshot', () => {
  assert.equal(clientSnapshotIPs(Array(100).fill('192.0.2.1')).size, 0);
  assert.equal(clientSnapshotIPs(['192.0.2.1', '192.0.2.2', '192.0.2.3']).size, 0);
  assert.equal(clientSnapshotIPs(['192.0.2.1', '192.0.2.2', '192.0.2.3', '192.0.2.4']).size, 4);
});
