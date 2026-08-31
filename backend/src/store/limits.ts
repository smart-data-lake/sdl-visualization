import { assertKeySafe } from './keys.js';

/**
 * The limits Azure Tables imposes, in one place, enforced above the driver.
 *
 * They live here rather than in each driver on purpose. A SQL or filesystem driver
 * has no such limits, so if each enforced its own, data written under one backend
 * would not load under another, and a violation would surface only on the deployment
 * that still had the constraint - which is the one place it is expensive to find.
 * Applying the union of the constraints everywhere keeps the data portable and keeps
 * the failure local.
 *
 * Every number here was measured against Azurite rather than read off a page - see
 * test/unit/limits.test.ts.
 */

/**
 * A string property is capped at 64 KiB, and the cap counts UTF-16 code units rather
 * than bytes: 32 769 times 'a' is refused with PropertyValueTooLarge, while 20 000
 * times a three-byte character (60 000 bytes) is accepted.
 */
export const MAX_PROPERTY_CHARS = 32_768;

/** A transaction takes at most 100 entities, all in one partition. */
export const MAX_BATCH = 100;

/**
 * A transaction body may not exceed 4 MB.
 *
 * Azurite does not enforce this - 100 entities carrying 30 000 characters each, about
 * 6 MB, is accepted there - so it is the one limit no test against the emulator can
 * catch. Hence this budget and the size-aware chunking in tables.ts: a large
 * configuration would otherwise fail only in production.
 *
 * The budget is under 4 MB because the wire format is a multipart batch whose
 * per-entity headers are not part of the JSON this is estimated from.
 */
export const MAX_TRANSACTION_BYTES = 3_500_000;

/** Estimated per-entity overhead of the multipart batch envelope. */
const ENTITY_ENVELOPE_BYTES = 512;

/** A record as the store sees it: two keys, and flat properties. */
export interface KeyedRecord {
  partitionKey: string;
  rowKey: string;
  [property: string]: unknown;
}

/** What a table property may hold. Deliberately narrow - see assertRecord. */
export type PropertyValue = string | number | undefined;

/**
 * Check one record, and return it ready to store.
 *
 * The value types are narrow because every backend has to round-trip them
 * identically. Booleans, Dates and objects are refused rather than converted: a
 * silent conversion is a divergence waiting to happen, nothing in the service layer
 * produces one today, and this is what keeps that true.
 *
 * NaN and Infinity are refused for a subtler reason. JSON.stringify turns both into
 * null, so a SQL driver would read them back as "no value" and, under merge
 * semantics, silently keep whatever was there before - while Azure stores them. The
 * durations are date arithmetic over an uploaded state file, so a malformed timestamp
 * can produce one.
 *
 * NUL is stripped rather than refused. It can only arrive inside SDLB exception text
 * or a configuration leaf value, where it means nothing, and failing an upload over it
 * would be worse than losing the character. Postgres cannot store it in jsonb at all,
 * so a driver that accepted it here would not be portable.
 */
export function assertRecord<T extends KeyedRecord>(record: T, what: string): T {
  assertKeySafe(requireKey(record.partitionKey, 'partitionKey', what), `${what} partitionKey`);
  assertKeySafe(requireKey(record.rowKey, 'rowKey', what), `${what} rowKey`);

  let sanitised: T | undefined;
  for (const [property, value] of Object.entries(record)) {
    if (property === 'partitionKey' || property === 'rowKey') continue;
    const clean = checkProperty(value, `${what}.${property}`);
    if (clean !== value) {
      sanitised ??= { ...record };
      (sanitised as KeyedRecord)[property] = clean;
    }
  }
  return sanitised ?? record;
}

/** assertRecord over a batch, plus the invariants that are about the batch as a whole. */
export function assertBatch<T extends KeyedRecord>(records: T[], what: string): T[] {
  const checked = records.map((record) => assertRecord(record, what));

  // Azure Tables refuses a transaction that repeats a key, and store/keys.ts leans on
  // that as a safety net - see the comment on runElementKey, where one attempt appears
  // once per action and once per data object it touched. A driver doing row-by-row
  // upserts would quietly merge the two instead, so the check belongs above them all.
  // Nested rather than a concatenated string key: joining the two with a separator
  // reintroduces exactly the collision assertKeyPart exists to prevent, since
  // ("a|b", "c") and ("a", "b|c") concatenate identically. Picking a character that is
  // currently illegal in a key would work until that list changed.
  const seen = new Map<string, Set<string>>();
  for (const record of checked) {
    let rowKeys = seen.get(record.partitionKey);
    if (!rowKeys) seen.set(record.partitionKey, (rowKeys = new Set()));
    if (rowKeys.has(record.rowKey)) {
      throw new Error(
        `${what} repeats the key ${JSON.stringify(record.partitionKey)} / ` +
          `${JSON.stringify(record.rowKey)}, which is a collision rather than an update`,
      );
    }
    rowKeys.add(record.rowKey);
  }
  return checked;
}

/** Estimated wire size of one record inside a transaction. */
export function estimateBytes(record: KeyedRecord): number {
  return Buffer.byteLength(JSON.stringify(record), 'utf8') + ENTITY_ENVELOPE_BYTES;
}

function requireKey(value: unknown, key: string, what: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${what} needs a non-empty ${key}, got ${JSON.stringify(value)}`);
  }
  return value;
}

function checkProperty(value: unknown, what: string): PropertyValue {
  if (value === undefined) return undefined;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${what} is ${String(value)}, which no backend can round-trip`);
    }
    return value;
  }

  if (typeof value === 'string') {
    if (value.length > MAX_PROPERTY_CHARS) {
      throw new Error(
        `${what} is ${value.length} characters, over the ${MAX_PROPERTY_CHARS} character ` +
          `property limit - truncate it, or put it in a blob`,
      );
    }
    return value.includes('\u0000') ? value.replaceAll('\u0000', '\uFFFD') : value;
  }

  throw new Error(
    `${what} is ${value === null ? 'null' : `a ${typeof value}`}. A table property may ` +
      `only be a string, a finite number, or absent.`,
  );
}
