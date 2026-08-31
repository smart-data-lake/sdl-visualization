import { describe, expect, test } from 'vitest';
import { TableClient } from '@azure/data-tables';
import {
  MAX_PROPERTY_CHARS,
  type KeyedRecord,
  assertBatch,
  assertRecord,
  estimateBytes,
} from '../../src/store/limits.js';
import { truncate } from '../../src/store/tables.js';
import { TEST_CONNECTION_STRING } from '../setup/azurite.js';

/**
 * What the constants in store/limits.ts actually are.
 *
 * The point of the first block is that these numbers are measured, not quoted. The
 * documented limit is "64 KiB per string property", which reads like a byte count and
 * is not one - services/runs.ts had a 60 000 character bound derived from it, which
 * meant every run between 32 769 and 60 000 characters of action state was refused with
 * PropertyValueTooLarge, failing the SDLB job. Nothing caught it because the fixtures
 * are small.
 */
describe('the limits, against the emulator', () => {
  const client = TableClient.fromConnectionString(TEST_CONNECTION_STRING, 'LimitsTest', {
    allowInsecureConnection: true,
  });

  const write = async (rowKey: string, big: string) => {
    await client.createTable();
    await client.upsertEntity({ partitionKey: 'p', rowKey, big }, 'Merge');
  };

  test('MAX_PROPERTY_CHARS is exactly what the store accepts', async () => {
    await expect(write('at-limit', 'a'.repeat(MAX_PROPERTY_CHARS))).resolves.toBeUndefined();
    await expect(write('over-limit', 'a'.repeat(MAX_PROPERTY_CHARS + 1))).rejects.toThrow(
      /PropertyValueTooLarge/,
    );
  });

  /** So the cap cannot be reasoned about in bytes, which is how the 60 000 arose. */
  test('the cap counts UTF-16 code units, not bytes', async () => {
    const threeBytesEach = 'X'.repeat(0) + 'A'.repeat(0) + '日'.repeat(20_000);
    expect(Buffer.byteLength(threeBytesEach, 'utf8')).toBe(60_000);
    expect(threeBytesEach.length).toBeLessThan(MAX_PROPERTY_CHARS);
    await expect(write('multibyte', threeBytesEach)).resolves.toBeUndefined();
  });

  test('a run of every plausible size survives the actionsJson bound', async () => {
    // What services/runs.ts now does, at the boundary it now uses.
    for (const length of [MAX_PROPERTY_CHARS - 1, MAX_PROPERTY_CHARS]) {
      await expect(write(`bound-${length}`, 'a'.repeat(length))).resolves.toBeUndefined();
    }
  });
});

describe('assertRecord', () => {
  const record = (extra: Record<string, unknown>): KeyedRecord => ({
    partitionKey: 'p',
    rowKey: 'r',
    ...extra,
  });

  test('passes a record of strings, finite numbers and absent values through unchanged', () => {
    const input = record({ a: 'x', b: 0, c: -3, d: 0.5, e: 1702279395123, f: undefined });
    expect(assertRecord(input, 'T')).toBe(input);
  });

  test.each([
    ['a boolean', { v: true }],
    ['null', { v: null }],
    ['an object', { v: { nested: 1 } }],
    ['an array', { v: [1] }],
    ['a Date', { v: new Date() }],
    ['a bigint', { v: 1n }],
  ])('refuses %s rather than converting it', (_label, extra) => {
    expect(() => assertRecord(record(extra), 'T')).toThrow(/may only be a string/);
  });

  /**
   * JSON.stringify turns both into null, so a SQL driver would read them back as "no
   * value" and, under merge semantics, keep the previous value instead - while Azure
   * stores them. The durations are date arithmetic over an uploaded state file.
   */
  test.each([NaN, Infinity, -Infinity])('refuses %s, which no backend round-trips', (v) => {
    expect(() => assertRecord(record({ v }), 'T')).toThrow(/round-trip/);
  });

  test('refuses a string over the property limit, naming the fix', () => {
    expect(() => assertRecord(record({ v: 'a'.repeat(MAX_PROPERTY_CHARS + 1) }), 'T')).toThrow(
      /over the 32768 character property limit/,
    );
  });

  test('strips NUL rather than failing the upload it arrived in', () => {
    const out = assertRecord(record({ msg: `a${'\u0000'}b` }), 'T');
    expect(out['msg']).toBe(`a${'\uFFFD'}b`);
  });

  test('refuses a missing or empty key', () => {
    expect(() => assertRecord({ partitionKey: 'p', rowKey: '' }, 'T')).toThrow(/non-empty rowKey/);
    expect(() =>
      assertRecord({ partitionKey: undefined as never, rowKey: 'r' }, 'T'),
    ).toThrow(/non-empty partitionKey/);
  });
});

describe('assertBatch', () => {
  const at = (partitionKey: string, rowKey: string) => ({ partitionKey, rowKey });

  /**
   * Azure Tables refuses a transaction that repeats a key, and store/keys.ts leans on
   * that: runElementKey puts the action in the row key precisely because one attempt
   * appears once per action and once per data object, and a collision there must be an
   * error rather than one row silently overwriting the other. A driver doing row-by-row
   * upserts would merge them, so the check has to live above the driver.
   */
  test('refuses a repeated key inside one batch', () => {
    expect(() => assertBatch([at('p', 'r'), at('p', 'r')], 'T')).toThrow(/repeats the key/);
  });

  test('the same row key in another partition is not a repeat', () => {
    expect(assertBatch([at('p1', 'r'), at('p2', 'r')], 'T')).toHaveLength(2);
  });

  /** The separator matters: without it "a|b"+"c" and "a"+"b|c" would look identical. */
  test('two different keys cannot look the same by concatenation', () => {
    expect(() => assertBatch([at('a|b', 'c'), at('a', 'b|c')], 'T')).not.toThrow();
  });

  test('estimateBytes counts the payload and the envelope', () => {
    expect(estimateBytes(at('p', 'r'))).toBeGreaterThan(512);
    expect(estimateBytes({ ...at('p', 'r'), big: 'a'.repeat(1000) })).toBeGreaterThan(1512);
  });
});

describe('truncate', () => {
  test('leaves a short value alone', () => {
    expect(truncate('short', 100)).toBe('short');
    expect(truncate(undefined)).toBeUndefined();
  });

  test('a truncated value carries a marker and stays under the bound', () => {
    const out = truncate('a'.repeat(500), 100)!;
    expect(out).toMatch(/\[truncated\]$/);
    expect(out.length).toBeLessThanOrEqual(100);
  });

  /** The bound counts the suffix, so this cannot produce a value the store refuses. */
  test('a bound at the property limit still yields a storable value', () => {
    const out = truncate('a'.repeat(MAX_PROPERTY_CHARS * 2), MAX_PROPERTY_CHARS)!;
    expect(out.length).toBeLessThanOrEqual(MAX_PROPERTY_CHARS);
    expect(() => assertRecord({ partitionKey: 'p', rowKey: 'r', v: out }, 'T')).not.toThrow();
  });
});
