import { badRequest } from '../errors.js';

/**
 * The limits and character rules the store applies, in one place, above the driver.
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

const ILLEGAL_KEY_CHARS = new RegExp('[/\\\\#?\\u0000-\\u001F\\u007F-\\u009F]');

/** Reject a value that cannot go into a key, rather than silently producing a broken one. */
export function assertKeySafe(value: string, what: string): string {
  if (ILLEGAL_KEY_CHARS.test(value)) {
    throw new Error(
      `${what} contains a character that is illegal in a table key: ${JSON.stringify(value)}`,
    );
  }
  if (value.length > 1024) throw new Error(`${what} is longer than the 1024 character key limit`);
  return value;
}

/**
 * A value that becomes one segment of a composite key.
 *
 * Stricter than assertKeySafe by exactly one character: the separator. Without
 * this, repo "a|b" with env "c" and repo "a" with env "b|c" produce the same
 * partition key, and one scope reads another's data. The route schemas already
 * forbid the separator, but the invariant belongs to the layer that relies on it,
 * not to the layer above.
 */
export function assertKeyPart(value: string, what: string): string {
  if (value.includes('|')) {
    throw new Error(`${what} must not contain the key separator "|": ${JSON.stringify(value)}`);
  }
  return assertKeySafe(value, what);
}

/**
 * A value that becomes one segment of a blob path.
 *
 * Blob names are opaque strings, so "", "." and ".." are merely odd there. Under a
 * filesystem driver the same path escapes the data directory - and DELETE
 * /descriptions/* would unlink outside it - so the guard has to exist before such a
 * driver does.
 *
 * It belongs here, called from every blobPaths builder, rather than in the services:
 * putConfig and putState both write the blob before they build the table key, so the
 * key assertions below run too late to protect the path. Validating where the path is
 * constructed closes the class whatever order a caller chooses.
 *
 * These are all caller-supplied values - a query parameter, or a field of an uploaded
 * state file - so this is a 400, where the key assertions below stay 500s for a value
 * the service itself produced.
 */
export function assertPathSegment(value: string, what: string): string {
  if (value.length === 0) throw badRequest(`${what} must not be empty`);
  if (value === '.' || value === '..') {
    throw badRequest(`${what} must not be "${value}"`);
  }
  if (ILLEGAL_KEY_CHARS.test(value)) {
    throw badRequest(
      `${what} contains a character that is illegal in a path segment: ${JSON.stringify(value)}`,
    );
  }
  if (value.length > 1024) throw badRequest(`${what} is longer than 1024 characters`);
  return value;
}

/**
 * A numeric blob-path segment.
 *
 * runId and attemptId are typed as numbers and read straight off an uploaded state
 * file, which is `any` - so the type is a claim about the caller, not a fact. Coerced
 * rather than type-checked because a numeric string has always been accepted here and
 * SDLB is entitled to keep sending one.
 */
export function assertPathNumber(value: number, what: string): string {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw badRequest(`${what} must be a non-negative integer, got ${JSON.stringify(value)}`);
  }
  return String(n);
}

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
  return checkValues(record, what, ['partitionKey', 'rowKey']);
}

/**
 * Check the values of a record, whatever shape a driver stores it in.
 *
 * Separate from assertRecord because a driver with real columns has no partition or row
 * key to check but the same reasons to refuse the same values - and one implementation
 * is the only way the two stay identical.
 */
export function checkValues<T extends object>(record: T, what: string, skip: string[] = []): T {
  let sanitised: T | undefined;
  for (const [property, value] of Object.entries(record)) {
    if (skip.includes(property)) continue;
    const clean = checkProperty(value, `${what}.${property}`);
    if (clean !== value) {
      sanitised ??= { ...record };
      (sanitised as Record<string, unknown>)[property] = clean;
    }
  }
  return sanitised ?? record;
}

/**
 * Refuse a key that appears twice in one batch.
 *
 * Azure Tables refuses such a transaction, and store/drivers/azureTables/keys.ts leans
 * on that as a safety net - see runElementKey, where one attempt appears once per action
 * and once per data object it touched. A driver doing row-by-row upserts would quietly
 * merge them instead, so both drivers call this.
 *
 * JSON rather than a joined string, because joining reintroduces exactly the collision
 * assertKeyPart exists to prevent: ["a|b","c"] and ["a","b|c"] join identically, and
 * quoting keeps them apart without depending on which characters are currently illegal.
 */
export function assertNoDuplicates(keys: (string | number)[][], what: string): void {
  const seen = new Set<string>();
  for (const key of keys) {
    const identity = JSON.stringify(key);
    if (seen.has(identity)) {
      throw new Error(
        `${what} repeats the key ${identity}, which is a collision rather than an update`,
      );
    }
    seen.add(identity);
  }
}

/** assertRecord over a batch, plus the invariants that are about the batch as a whole. */
export function assertBatch<T extends KeyedRecord>(records: T[], what: string): T[] {
  const checked = records.map((record) => assertRecord(record, what));
  assertNoDuplicates(
    checked.map((record) => [record.partitionKey, record.rowKey]),
    what,
  );
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

const TRUNCATION_SUFFIX = '… [truncated]';

/**
 * Bring a string under the property limit. Anything that would still be too big
 * belongs in a blob instead.
 *
 * `max` counts the result, suffix included, so a caller cannot ask for a bound that
 * still produces an over-limit value - which is what `truncate(v, MAX_PROPERTY_CHARS)`
 * would otherwise do.
 */
export function truncate(value: string | undefined, max = 30_000): string | undefined {
  if (value === undefined) return undefined;
  const limit = Math.min(max, MAX_PROPERTY_CHARS) - TRUNCATION_SUFFIX.length;
  return value.length <= max && value.length <= MAX_PROPERTY_CHARS
    ? value
    : `${value.slice(0, limit)}${TRUNCATION_SUFFIX}`;
}
