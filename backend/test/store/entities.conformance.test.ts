import { beforeAll, describe, expect, test } from 'vitest';
import { createAzureTablesRepositories } from '../../src/store/drivers/azureTables/index.js';
import type { Repositories } from '../../src/store/repositories.js';
import type { RunElementRecord, RunRecord, Scope } from '../../src/store/types.js';
import { MAX_BATCH } from '../../src/store/limits.js';
import { TEST_CONNECTION_STRING } from '../setup/azurite.js';

/**
 * One contract, run against every entity driver.
 *
 * This is the same idea as test/unit/parity.test.ts - run two implementations over the
 * same input and assert they agree, rather than writing each one its own examples that
 * can drift apart - applied to the drivers instead of to the ported domain logic. Every
 * case below is something a service actually depends on, and most of them are things a
 * second driver would plausibly get wrong.
 *
 * The drivers are constructed here directly, with explicit options, which is why they
 * are not allowed to read settings() themselves.
 */

interface Driver {
  name: string;
  create: () => Repositories;
}

const DRIVERS: Driver[] = [
  {
    name: 'azureTables',
    create: () =>
      createAzureTablesRepositories({
        storage: { kind: 'connectionString', value: TEST_CONNECTION_STRING },
      }),
  },
];

/** A scope of its own per case, so the suite never depends on what another test left. */
let counter = 0;
const freshScope = (): Scope => ({ repo: `conf-${++counter}-${process.pid}`, env: 'dev' });

const run = (over: Partial<RunRecord> & { runId: number; attemptId: number }): RunRecord => ({
  name: 'wf',
  status: 'SUCCEEDED',
  blobPath: `p/${over.runId}/${over.attemptId}.json`,
  ...over,
});

const element = (
  over: Partial<RunElementRecord> & { runId: number; attemptId: number; actionId: string },
): RunElementRecord => ({
  workflow: 'wf',
  state: 'SUCCEEDED',
  inputIds: [],
  outputIds: [],
  ...over,
});

describe.each(DRIVERS)('$name', ({ create }) => {
  let store: Repositories;
  beforeAll(() => {
    store = create();
  });

  describe('round-tripping a record', () => {
    test('what went in comes back, and nothing else does', async () => {
      const scope = freshScope();
      await store.runs.putRun(scope, run({ runId: 1, attemptId: 0, feedSel: 'ids:a' }));

      const got = await store.runs.getRun(scope, 'wf', 1, 0);
      expect(got).toBeDefined();
      expect(got).toMatchObject({ name: 'wf', runId: 1, attemptId: 0, feedSel: 'ids:a' });

      // Nothing of the storage layout leaks out: no keys, and none of the etag or
      // timestamp the Azure SDK attaches. Whether an absent field is omitted or present
      // as undefined is deliberately not pinned - drivers may differ, and no caller
      // distinguishes the two.
      for (const forbidden of ['partitionKey', 'rowKey', 'etag', 'timestamp', 'PartitionKey', 'RowKey']) {
        expect(got).not.toHaveProperty(forbidden);
      }
    });

    test('a missing record is undefined rather than a throw', async () => {
      expect(await store.runs.getRun(freshScope(), 'wf', 9, 9)).toBeUndefined();
      expect(await store.runs.getWorkflowSummary(freshScope(), 'wf')).toBeUndefined();
      expect(await store.tokens.get(freshScope(), 'nope')).toBeUndefined();
    });

    test('numbers survive exactly, and stay numbers', async () => {
      const scope = freshScope();
      // The largest is a millisecond epoch; the smallest exercise sign and fraction.
      for (const value of [0, -3, 0.5, 2 ** 31, 1_702_279_395_123, Number.MAX_SAFE_INTEGER]) {
        await store.runs.putRun(scope, run({ runId: 1, attemptId: 0, duration: value }));
        const got = await store.runs.getRun(scope, 'wf', 1, 0);
        expect(typeof got!.duration).toBe('number');
        expect(got!.duration).toBe(value);
      }
    });

    test('nested values come back as values, not as JSON', async () => {
      const scope = freshScope();
      await store.runs.putRun(
        scope,
        run({
          runId: 1,
          attemptId: 0,
          actions: { a: { state: 'FAILED', dataObjects: ['x'] } },
          dataObjects: ['x', 'y'],
          actionsStatus: { FAILED: 1 },
        }),
      );
      const got = await store.runs.getRun(scope, 'wf', 1, 0);
      expect(got!.actions).toEqual({ a: { state: 'FAILED', dataObjects: ['x'] } });
      expect(got!.dataObjects).toEqual(['x', 'y']);
      expect(got!.actionsStatus).toEqual({ FAILED: 1 });
    });
  });

  /**
   * The invariant the whole store rests on. resolveToken writes lastUsedAt and nothing
   * else, while mintToken may be writing the same partition, so a driver that
   * implemented a write as read-modify-write would drop the other write.
   */
  describe('merge semantics', () => {
    test('a touch leaves every other field alone', async () => {
      const scope = freshScope();
      await store.tokens.put(scope, {
        id: 'h1',
        email: 'a@b.c',
        label: 'laptop',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      await store.tokens.touch(scope, 'h1', '2026-02-02T00:00:00.000Z');

      expect(await store.tokens.get(scope, 'h1')).toEqual({
        id: 'h1',
        email: 'a@b.c',
        label: 'laptop',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: undefined,
        lastUsedAt: '2026-02-02T00:00:00.000Z',
      });
    });

    test('an absent field does not erase the stored one', async () => {
      const scope = freshScope();
      await store.tokens.put(scope, {
        id: 'h1',
        email: 'a@b.c',
        label: 'first',
        createdAt: 'c',
        expiresAt: 'e',
      });
      await store.tokens.put(scope, { id: 'h1', email: 'a@b.c', label: 'second', createdAt: 'c' });

      const got = await store.tokens.get(scope, 'h1');
      expect(got!.label).toBe('second');
      expect(got!.expiresAt).toBe('e');
    });

    test('two concurrent touches of disjoint fields both survive', async () => {
      const scope = freshScope();
      await store.tokens.put(scope, { id: 'h1', email: 'a@b.c', label: 'l', createdAt: 'c' });
      await Promise.all([
        store.tokens.touch(scope, 'h1', '2026-03-03T00:00:00.000Z'),
        store.workspaces.putRule('conc.example.net', { repos: 'r' }),
      ]);
      expect((await store.tokens.get(scope, 'h1'))!.label).toBe('l');
    });
  });

  describe('ordering', () => {
    test('runs come back newest first, whatever order they arrived in', async () => {
      const scope = freshScope();
      for (const [runId, attemptId] of [[2, 0], [10, 1], [1, 0], [10, 0], [2, 1]]) {
        await store.runs.putRun(scope, run({ runId, attemptId }));
      }
      const listed = await store.runs.listRuns(scope, 'wf', 100);
      expect(listed.map((r) => [r.runId, r.attemptId])).toEqual([
        [10, 1],
        [10, 0],
        [2, 1],
        [2, 0],
        [1, 0],
      ]);
    });

    test('timestamps come back newest first', async () => {
      const scope = freshScope();
      for (const tstamp of [1700000000, 1800000000, 1600000000]) {
        await store.schemaStats.put(scope, 'schema', 'obj', { tstamp, blobPath: 'p', sizeBytes: 1 });
      }
      expect(await store.schemaStats.listTstamps(scope, 'schema', 'obj')).toEqual([
        1800000000, 1700000000, 1600000000,
      ]);
    });

    test('the two series are separate', async () => {
      const scope = freshScope();
      await store.schemaStats.put(scope, 'schema', 'obj', { tstamp: 1, blobPath: 'p', sizeBytes: 1 });
      expect(await store.schemaStats.listTstamps(scope, 'stats', 'obj')).toEqual([]);
    });

    test('a limit truncates in that order rather than arbitrarily', async () => {
      const scope = freshScope();
      for (const runId of [1, 2, 3, 4, 5]) await store.runs.putRun(scope, run({ runId, attemptId: 0 }));
      expect((await store.runs.listRuns(scope, 'wf', 2)).map((r) => r.runId)).toEqual([5, 4]);
    });

    test('a limit above the count is not an error', async () => {
      const scope = freshScope();
      await store.runs.putRun(scope, run({ runId: 1, attemptId: 0 }));
      expect(await store.runs.listRuns(scope, 'wf', 500)).toHaveLength(1);
    });

    test('an empty partition is an empty list', async () => {
      const scope = freshScope();
      expect(await store.runs.listRuns(scope, 'wf', 10)).toEqual([]);
      expect(await store.runs.listWorkflows(scope)).toEqual([]);
      expect(await store.tokens.list(scope)).toEqual([]);
      expect(await store.configs.listVersions(scope)).toEqual([]);
    });
  });

  describe('isolation', () => {
    test('one scope cannot see another', async () => {
      const a = freshScope();
      const b = freshScope();
      await store.runs.putRun(a, run({ runId: 1, attemptId: 0 }));
      expect(await store.runs.listRuns(b, 'wf', 10)).toEqual([]);
    });

    test('one workflow cannot see another', async () => {
      const scope = freshScope();
      await store.runs.putRun(scope, run({ runId: 1, attemptId: 0, name: 'first' }));
      expect(await store.runs.listRuns(scope, 'second', 10)).toEqual([]);
    });
  });

  describe('counting', () => {
    test('attempts and distinct runs are counted separately', async () => {
      const scope = freshScope();
      for (const [runId, attemptId] of [[1, 0], [1, 1], [2, 0]]) {
        await store.runs.putRun(scope, run({ runId, attemptId }));
      }
      expect(await store.runs.countRunsAndAttempts(scope, 'wf')).toEqual({
        numRuns: 2,
        numAttempts: 3,
      });
    });

    test('nothing recorded counts as zero, not as a failure', async () => {
      expect(await store.runs.countRunsAndAttempts(freshScope(), 'wf')).toEqual({
        numRuns: 0,
        numAttempts: 0,
      });
    });
  });

  describe('batches', () => {
    test('a batch larger than one transaction still lands whole', async () => {
      const scope = freshScope();
      const many = Array.from({ length: MAX_BATCH * 2 + 7 }, (_, i) =>
        element({ runId: 1, attemptId: 0, actionId: `a${String(i).padStart(4, '0')}` }),
      );
      await store.runs.putRunElements(scope, many);
      const listed = await store.runs.listRunElements(scope, { kind: 'action', id: 'a0000' }, 10);
      expect(listed).toHaveLength(1);
      expect(listed[0]!.actionId).toBe('a0000');
    });

    test('an empty batch is a no-op rather than an error', async () => {
      await expect(store.runs.putRunElements(freshScope(), [])).resolves.toBeUndefined();
      await expect(store.configs.putElements(freshScope(), 'v', [])).resolves.toBeUndefined();
    });

    /**
     * Azure refuses a transaction that repeats a key, and keys.ts leans on that: the
     * action is part of the row key precisely so that two actions sharing a data object
     * do not collide. A driver doing row-by-row upserts would merge them silently.
     */
    test('a repeated key inside one batch is an error, not an overwrite', async () => {
      const scope = freshScope();
      await expect(
        store.runs.putRunElements(scope, [
          element({ runId: 1, attemptId: 0, actionId: 'same' }),
          element({ runId: 1, attemptId: 0, actionId: 'same' }),
        ]),
      ).rejects.toThrow();
    });

    test('one attempt appears under each data object it touched', async () => {
      const scope = freshScope();
      await store.runs.putRunElements(scope, [
        element({ runId: 1, attemptId: 0, actionId: 'act', inputIds: ['in'], outputIds: ['out'] }),
      ]);
      for (const id of ['in', 'out']) {
        const rows = await store.runs.listRunElements(scope, { kind: 'dataObject', id }, 10);
        expect(rows.map((r) => r.actionId)).toEqual(['act']);
      }
    });

    test('element rows carry their parsed id lists back', async () => {
      const scope = freshScope();
      await store.runs.putRunElements(scope, [
        element({ runId: 1, attemptId: 0, actionId: 'act', inputIds: ['a', 'b'], outputIds: ['c'] }),
      ]);
      const [row] = await store.runs.listRunElements(scope, { kind: 'action', id: 'act' }, 10);
      expect(row!.inputIds).toEqual(['a', 'b']);
      expect(row!.outputIds).toEqual(['c']);
    });
  });

  describe('by element', () => {
    test('the attempts that touched an element come back newest first, once each', async () => {
      const scope = freshScope();
      for (const runId of [1, 2, 3]) {
        await store.runs.putRun(scope, run({ runId, attemptId: 0 }));
        await store.runs.putRunElements(scope, [
          element({ runId, attemptId: 0, actionId: 'act', outputIds: ['obj'] }),
        ]);
      }
      const byObject = await store.runs.listRunsTouching(scope, { kind: 'dataObject', id: 'obj' }, 10);
      expect(byObject.map((r) => r.runId)).toEqual([3, 2, 1]);
    });

    test('an element nothing touched yields nothing', async () => {
      const scope = freshScope();
      expect(await store.runs.listRunsTouching(scope, { kind: 'action', id: 'nope' }, 5)).toEqual([]);
      expect(await store.runs.listRunElements(scope, { kind: 'action', id: 'nope' }, 5)).toEqual([]);
    });
  });

  describe('deleting', () => {
    test('deleting something absent is not an error', async () => {
      await expect(store.tokens.delete(freshScope(), 'missing')).resolves.toBeUndefined();
    });

    test('a deleted record is gone, and writing again starts fresh', async () => {
      const scope = freshScope();
      await store.tokens.put(scope, {
        id: 'h1',
        email: 'a@b.c',
        label: 'l',
        createdAt: 'c',
        expiresAt: 'e',
      });
      await store.tokens.delete(scope, 'h1');
      expect(await store.tokens.get(scope, 'h1')).toBeUndefined();

      // Not merged with the row that was deleted: expiresAt must not come back.
      await store.tokens.put(scope, { id: 'h1', email: 'a@b.c', label: 'l', createdAt: 'c' });
      expect((await store.tokens.get(scope, 'h1'))!.expiresAt).toBeUndefined();
    });
  });

  describe('scopes and workflows', () => {
    test('registering a scope makes its repo and env findable', async () => {
      const scope = freshScope();
      await store.scopes.register(scope);
      expect(await store.scopes.listRepos()).toContain(scope.repo);
      expect(await store.scopes.listEnvs(scope.repo)).toEqual(['dev']);
    });

    test('workflows come back in name order', async () => {
      const scope = freshScope();
      for (const name of ['zeta', 'Alpha', 'mid']) {
        await store.runs.putWorkflowSummary(scope, { name, numRuns: 1, numAttempts: 1 });
      }
      expect((await store.runs.listWorkflows(scope)).map((w) => w.name)).toEqual([
        'Alpha',
        'mid',
        'zeta',
      ]);
    });

    test('a workflow summary round-trips its name and counts', async () => {
      const scope = freshScope();
      await store.runs.putWorkflowSummary(scope, {
        name: 'wf',
        numRuns: 2,
        numAttempts: 3,
        lastStatus: 'FAILED',
        lastRunId: 7,
        lastAttemptId: 1,
      });
      expect(await store.runs.getWorkflowSummary(scope, 'wf')).toMatchObject({
        name: 'wf',
        numRuns: 2,
        numAttempts: 3,
        lastStatus: 'FAILED',
        lastRunId: 7,
        lastAttemptId: 1,
      });
    });

    test('config versions round-trip by name', async () => {
      const scope = freshScope();
      for (const version of ['latest', '1.0']) {
        await store.configs.putVersion(scope, {
          version,
          createdAt: 'c',
          blobPath: 'p',
          numDataObjects: 1,
          numActions: 2,
          numConnections: 3,
        });
      }
      expect((await store.configs.listVersions(scope)).sort()).toEqual(['1.0', 'latest']);
    });

    test('a workspace with no rule reads as undefined, which means "everything"', async () => {
      expect(await store.workspaces.getRule('never-provisioned.example.net')).toBeUndefined();
    });

    test('a provisioned rule reads back', async () => {
      await store.workspaces.putRule('rule.example.net', {
        repos: 'a,b',
        requiredGroup: 'admins',
      });
      expect(await store.workspaces.getRule('rule.example.net')).toEqual({
        repos: 'a,b',
        envs: undefined,
        requiredGroup: 'admins',
      });
    });
  });
});
