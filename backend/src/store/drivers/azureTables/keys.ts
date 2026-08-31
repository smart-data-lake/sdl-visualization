import {
  assertKeyPart,
  assertKeySafe,
} from '../../limits.js';
import type { Scope } from '../../types.js';

/**
 * Partition and row keys for the Azure Tables driver.
 *
 * Two constraints shape everything here, and neither is anybody else's problem - which
 * is why this lives under the driver rather than in store/:
 *  - Table Storage sorts only by PartitionKey then RowKey, ascending, as strings.
 *    Newest-first therefore has to be baked into the key, see inv().
 *  - "/", "\\", "#", "?" and control characters are illegal in keys. "|" is legal,
 *    which is why it is the separator. The rules themselves are in store/limits.ts,
 *    because every driver has to honour them for the data to stay portable.
 */

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
