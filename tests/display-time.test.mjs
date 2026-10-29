import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/display-time.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const exports = {};
new Function('exports', 'require', compiled)(exports, createRequire(new URL('../src/lib/display-time.ts', import.meta.url)));
const { moment, formatDisplayTime, filterTimestamp, statisticsTime, nextStatisticsDay, parseTimeSettings, validTimeZone } = exports;

test('display does not follow browser timezone and never changes the source instant', () => {
  assert.equal(formatDisplayTime(Date.parse('2026-10-27T11:06:20Z'), 'Asia/Shanghai'), '2026/10/27 19:06:20');
  const instant = Date.parse('2026-10-27T12:34:56Z');
  const original = process.env.TZ;
  try {
    for (const browserZone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = browserZone;
      assert.equal(formatDisplayTime(instant, 'Asia/Shanghai'), '2026/10/27 20:34:56');
      assert.equal(formatDisplayTime(instant, 'UTC'), '2026/10/27 12:34:56');
      assert.equal(formatDisplayTime(instant, 'America/New_York'), '2026/10/27 08:34:56');
      assert.equal(filterTimestamp(moment.utc(instant).tz('Asia/Shanghai')), instant);
      assert.equal(filterTimestamp(moment.utc(instant)), instant);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('date picker wall time maps back to the intended UTC filters, including zero', () => {
  assert.equal(filterTimestamp(moment.tz('2026-10-27 20:00','Asia/Shanghai')), Date.parse('2026-10-27T12:00:00Z'));
  assert.equal(filterTimestamp(moment.tz('2026-10-27 08:00','America/New_York')), Date.parse('2026-10-27T12:00:00Z'));
  assert.equal(filterTimestamp(moment.utc(0)), 0);
  for (const value of [null, undefined, '', '2026-10-27 20:00', moment.invalid()]) assert.equal(filterTimestamp(value), undefined);
});

test('server chart strings are interpreted in source zone independently of display zone', () => {
  const bucket = statisticsTime('2026-10-27 00:00:00', 'Asia/Shanghai');
  assert.equal(bucket.valueOf(), Date.parse('2026-10-26T16:00:00Z'));
  assert.equal(formatDisplayTime(bucket.valueOf(), 'UTC'), '2026/10/26 16:00:00');
  assert.equal(statisticsTime('2026-10-27T00:00:00Z', 'Asia/Shanghai').valueOf(), Date.parse('2026-10-27T00:00:00Z'));
  assert.equal(nextStatisticsDay('2026-10-27', 'Asia/Shanghai'), Date.parse('2026-10-27T16:00:00Z'));
});

test('daily bucket boundaries honor 23 and 25 hour DST days', () => {
  for (const [date, hours] of [['2026-03-08', 23], ['2026-11-01', 25]]) {
    const start = statisticsTime(date, 'America/New_York').valueOf();
    assert.equal(nextStatisticsDay(date, 'America/New_York') - start, hours * 3600000);
  }
});

test('invalid stored preferences use explicit Beijing defaults, never system timezone', () => {
  for (const raw of [null, '{', 'null', '[]', '123', '{"timeZone":"system","statisticsTimeZone":"bad"}']) {
    assert.deepEqual(parseTimeSettings(raw), { timeZone: 'Asia/Shanghai', statisticsTimeZone: 'Asia/Shanghai' });
  }
  assert.equal(validTimeZone('default'), false);
  assert.deepEqual(parseTimeSettings('{"timeZone":"UTC","statisticsTimeZone":"Europe/Berlin"}'), { timeZone: 'UTC', statisticsTimeZone: 'Europe/Berlin' });
  assert.equal(formatDisplayTime(NaN, 'UTC'), '—');
  assert.equal(formatDisplayTime('bad', 'UTC'), '—');
});

test('timezone extension overrides cannot leak into display, chart buckets or filter instants', () => {
  const originalLocale = Date.prototype.toLocaleString;
  const originalOffset = Date.prototype.getTimezoneOffset;
  try {
    Date.prototype.toLocaleString = function(locale) {
      return originalLocale.call(this, locale, { timeZone: 'America/Los_Angeles' });
    };
    Date.prototype.getTimezoneOffset = () => -480;
    const instant = Date.parse('2026-10-27T12:34:56Z');
    assert.equal(formatDisplayTime(instant, 'Asia/Shanghai'), '2026/10/27 20:34:56');
    assert.equal(formatDisplayTime(instant, 'UTC'), '2026/10/27 12:34:56');
    const bucket = statisticsTime('2026-10-27 20:00:00', 'Asia/Shanghai');
    assert.equal(formatDisplayTime(bucket.valueOf(), 'Asia/Shanghai', 'HH:mm'), '20:00');
    assert.equal(filterTimestamp(bucket), Date.parse('2026-10-27T12:00:00Z'));
    assert.equal(nextStatisticsDay('2026-10-27', 'Asia/Shanghai'), Date.parse('2026-10-27T16:00:00Z'));
  } finally {
    Date.prototype.toLocaleString = originalLocale;
    Date.prototype.getTimezoneOffset = originalOffset;
  }
});

test('explicit timezone operations do not call native local date formatting or offsets', () => {
  const originalLocale = Date.prototype.toLocaleString;
  const originalOffset = Date.prototype.getTimezoneOffset;
  try {
    Date.prototype.toLocaleString = () => { throw new Error('local formatting is forbidden'); };
    Date.prototype.getTimezoneOffset = () => { throw new Error('local offset is forbidden'); };
    const bucket = statisticsTime('2026-11-01', 'America/New_York');
    assert.equal(formatDisplayTime(bucket.valueOf(), 'UTC'), '2026/11/01 04:00:00');
    assert.equal(nextStatisticsDay('2026-11-01', 'America/New_York') - bucket.valueOf(), 25 * 3600000);
  } finally {
    Date.prototype.toLocaleString = originalLocale;
    Date.prototype.getTimezoneOffset = originalOffset;
  }
});

test('Change Timezone cannot override explicit zones through Intl.DateTimeFormat', () => {
  const NativeFormatter = Intl.DateTimeFormat;
  try {
    // The installed Change Timezone 3.0.0 script replaces explicit options too.
    Intl.DateTimeFormat = function(locales, options = {}) {
      Object.assign(options, { timeZone: 'America/Los_Angeles' });
      return new NativeFormatter(locales, options);
    };
    const instant = Date.parse('2026-10-27T12:34:56Z');
    assert.equal(formatDisplayTime(instant, 'Asia/Shanghai'), '2026/10/27 20:34:56');
    assert.equal(formatDisplayTime(instant, 'UTC'), '2026/10/27 12:34:56');
    assert.equal(validTimeZone('Not/A_Zone'), false);
    const bucket = statisticsTime('2026-10-27 20:00:00', 'Asia/Shanghai');
    assert.equal(bucket.valueOf(), Date.parse('2026-10-27T12:00:00Z'));
    assert.equal(formatDisplayTime(bucket.valueOf(), 'Asia/Shanghai', 'HH:mm'), '20:00');
    assert.equal(filterTimestamp(moment.utc(instant).tz('Asia/Shanghai')), instant);
  } finally { Intl.DateTimeFormat = NativeFormatter; }
});

 test('uncommon zones remain valid and load their complete IANA rules on demand', async () => {
 assert.equal(validTimeZone('Pacific/Chatham'), true);
 assert.equal(exports.timeZoneRulesReady(['Pacific/Chatham']), false);
 await exports.ensureTimeZoneRules(['Pacific/Chatham']);
 assert.equal(exports.timeZoneRulesReady(['Pacific/Chatham']), true);
 assert.equal(formatDisplayTime(Date.parse('2026-01-01T00:00:00Z'), 'Pacific/Chatham'), '2026/01/01 13:45:00');
 });
