import { badRequest } from '../errors.js';

/**
 * Partition and row keys for the Azure Tables layer, and the segments of a blob path.
 *
 * Two constraints shape everything here:
 *  - Table Storage sorts only by PartitionKey then RowKey, ascending, as strings.
 *    Newest-first therefore has to be baked into the key, see inv().
 *  - "/", "\", "#", "?" and control characters are illegal in keys. "|" is legal,
 *    which is why it is the separator.
 */

export interface Scope {
  repo: string;
  env: string;
}

/** Widest value inv() can represent; well past any plausible runId or epoch millisecond count. */
const INV_BASE = 9_999_999_999_999;
const INV_WIDTH = String(INV_BASE).length;

/**
 * Invert a number into a fixed-width string that sorts descending.
 * inv(1) > inv(2), so a plain ascending RowKey scan returns the newest first.
 */
export function inv(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > INV_BASE) {
    throw new RangeError(`Cannot invert ${n}: outside 0..${INV_BASE}`);
  }
  return String(INV_BASE - Math.trunc(n)).padStart(INV_WIDTH, '0');
}

/** Undo inv(), reading a key back into the number it encodes. */
export function uninv(s: string): number {
  return INV_BASE - Number(s);
}

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

export function scopeKey(scope: Scope): string {
  return `${assertKeyPart(scope.repo, 'repo')}|${assertKeyPart(scope.env, 'env')}`;
}

/** RowKey of a run: the newest attempt of the newest run sorts first. */
export function runKey(runId: number, attemptId: number): string {
  return `${inv(runId)}|${inv(attemptId)}`;
}

export function parseRunKey(rowKey: string): { runId: number; attemptId: number } {
  const [run, attempt] = rowKey.split('|');
  return { runId: uninv(run), attemptId: uninv(attempt) };
}

/**
 * RowKey of one action's part in one attempt.
 *
 * The action has to be in the key: in the data-object partitions the same attempt
 * appears once per action that read or wrote that data object, so runKey alone
 * collides - and a collision inside a table transaction is a hard error, not a
 * silent overwrite. runId and attemptId still lead, so the ordering is unchanged.
 */
export function runElementKey(runId: number, attemptId: number, actionId: string): string {
  return `${runKey(runId, attemptId)}|${assertKeyPart(actionId, 'actionId')}`;
}

export const keys = {
  workflows: (scope: Scope) => scopeKey(scope),
  runs: (scope: Scope, workflow: string) =>
    `${scopeKey(scope)}|${assertKeyPart(workflow, 'workflow')}`,
  /** Runs indexed by an action that took part in them. */
  runsByAction: (scope: Scope, action: string) =>
    `${scopeKey(scope)}|A|${assertKeyPart(action, 'actionId')}`,
  /** Runs indexed by a data object they wrote or read. */
  runsByDataObject: (scope: Scope, id: string) =>
    `${scopeKey(scope)}|D|${assertKeyPart(id, 'dataObjectId')}`,
  configVersions: (scope: Scope) => scopeKey(scope),
  configElements: (scope: Scope, version: string) =>
    `${scopeKey(scope)}|${assertKeyPart(version, 'version')}`,
  elements: (scope: Scope, elementType: string) => `${scopeKey(scope)}|${elementType}`,
  tstamps: (scope: Scope, subtype: 'schema' | 'stats', elementName: string) =>
    `${scopeKey(scope)}|${subtype}|${assertKeyPart(elementName, 'dataObjectId')}`,
  mcpTokens: (scope: Scope) => scopeKey(scope),
  workspaces: () => 'WS',
  metaRepos: () => 'REPO',
  metaEnvs: (repo: string) => `ENV|${assertKeyPart(repo, 'repo')}`,
};

/**
 * RowKey of a config version. Kept as the plain version string: versions are free-form
 * (SDLB defaults to "latest"), so there is no numeric ordering to preserve, and the SPA
 * sorts and reverses the list itself in getConfigVersions.
 */
export function versionKey(version: string): string {
  return assertKeySafe(version, 'version');
}
