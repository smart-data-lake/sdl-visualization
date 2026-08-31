import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildFastify } from '../../src/app.js';
import { useTempStore } from '../setup/store.js';
import { FIXTURES, SEED_SCOPE, SEED_VERSION, seedFixtures } from '../../scripts/seed-fixtures.js';

/**
 * The response contract, checked against the data the fixtures actually contain.
 *
 * The upstream OpenAPI declares every response as an empty schema, so it pins paths
 * and parameters and says nothing about payloads. That makes this file the only
 * thing holding the shapes the SPA depends on - the `{config: ...}` wrapper, the
 * `{content: ...}` of a markdown description, the `{stats: ...}` of statistics,
 * timestamps as ISO strings rather than Date - and the numbers are compared against
 * state/index.json, which build_index.py produced from these same state files and
 * which the local file backend serves verbatim.
 */

let app: FastifyInstance;

const Q = new URLSearchParams(SEED_SCOPE).toString();

async function get(url: string) {
  return app.inject({ method: 'GET', url });
}

async function json<T = any>(url: string): Promise<T> {
  const response = await get(url);
  expect(response.statusCode, `${url} -> ${response.body}`).toBe(200);
  return response.json() as T;
}

/** state/index.json is JSON Lines: exactly what build_index.py writes. */
async function fixtureIndex(): Promise<any[]> {
  const text = await readFile(path.join(FIXTURES, 'shared/state/index.json'), 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

let store: Awaited<ReturnType<typeof useTempStore>>;

beforeAll(async () => {
  store = await useTempStore();
  app = await buildFastify();
  await seedFixtures(app);
});

afterAll(async () => {
  await app?.close();
  await store?.cleanup();
});

describe('workspace', () => {
  test('a single tenant is reported, and it is the one the SPA adopts', async () => {
    // The SPA takes the name from here rather than defaulting to one of its own, so
    // this answer is what ends up in the URL. "PrivateTenant" is the env default.
    expect(await json('/api/v1/tenants')).toEqual(['PrivateTenant']);
  });

  test('the repo and env appear from having been uploaded to, with nothing provisioned', async () => {
    expect(await json('/api/v1/repo?tenant=PrivateTenant')).toEqual(['getting-started']);
    expect(await json('/api/v1/envs?tenant=PrivateTenant&repo=getting-started')).toEqual(['dev']);
  });

  test('the tenant parameter is accepted but ignored', async () => {
    const withOtherTenant = new URLSearchParams({ ...SEED_SCOPE, tenant: 'somebody_else' });
    expect(await json(`/api/v1/workflows?${withOtherTenant}`)).toEqual(
      await json(`/api/v1/workflows?${Q}`),
    );
  });
});

describe('workflows and runs match what build_index.py derived from the same state files', () => {
  test('the workflow summary counts every attempt and every distinct run', async () => {
    const index = await fixtureIndex();
    const workflows = await json(`/api/v1/workflows?${Q}`);

    expect(workflows).toHaveLength(1);
    expect(workflows[0].name).toBe('getting-started');
    expect(workflows[0].numAttempts).toBe(index.length);
    expect(workflows[0].numRuns).toBe(new Set(index.map((r) => r.runId)).size);
  });

  test('every attempt is listed, newest first', async () => {
    const index = await fixtureIndex();
    const runs = await json(`/api/v1/workflow?${Q}&application=getting-started`);

    expect(runs).toHaveLength(index.length);
    const order = runs.map((r: any) => `${r.runId}.${r.attemptId}`);
    expect(order).toEqual([...order].sort(byRunDescending));
  });

  test('each attempt carries the status, feed and action states the index has', async () => {
    const index = await fixtureIndex();
    const runs = await json(`/api/v1/workflow?${Q}&application=getting-started`);

    for (const expected of index) {
      const actual = runs.find(
        (r: any) => r.runId === expected.runId && r.attemptId === expected.attemptId,
      );
      expect(actual, `attempt ${expected.runId}.${expected.attemptId} is missing`).toBeDefined();
      expect(actual.status).toBe(expected.status);
      expect(actual.feedSel).toBe(expected.feedSel);
      expect(Object.keys(actual.actions).sort()).toEqual(Object.keys(expected.actions).sort());
      for (const [name, action] of Object.entries<any>(expected.actions)) {
        expect(actual.actions[name].state).toBe(action.state);
        expect(actual.actions[name].dataObjects.sort()).toEqual([...action.dataObjects].sort());
      }
    }
  });

  test('the fields the local backend derives client-side are precomputed here', async () => {
    const runs = await json(`/api/v1/workflow?${Q}&application=getting-started`);
    const failed = runs.find((r: any) => r.runId === 24 && r.attemptId === 1);

    // getIndex() in fetchAPI_local_statefiles adds these three after fetching.
    expect(failed.actionsStatus).toEqual({ SUCCEEDED: 2, FAILED: 1, CANCELLED: 2 });
    expect(failed.dataObjects.sort()).toEqual([
      'btl-departures-arrivals-airports',
      'btl-distances',
      'int-airports',
      'int-departures',
      'stg-airports',
    ]);
    expect(failed.duration).toBeGreaterThan(0);
    expect(failed.attemptStartTimeMillis).toBe(Date.parse(failed.attemptStartTime));
  });

  test('timestamps are ISO strings, because the SPA parses them itself', async () => {
    const runs = await json(`/api/v1/workflow?${Q}&application=getting-started`);
    for (const run of runs) {
      expect(run.attemptStartTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Number.isNaN(Date.parse(run.attemptStartTime))).toBe(false);
    }
  });
});

describe('one attempt', () => {
  test('the state file comes back with its actions intact', async () => {
    const state = await json(`/api/v1/state?${Q}&application=getting-started&runId=24&attemptId=1`);
    expect(state.appConfig.applicationName).toBe('getting-started');
    expect(state.runId).toBe(24);
    expect(state.attemptId).toBe(1);
    expect(Object.keys(state.actionsState)).toHaveLength(5);
    expect(state.actionsState['download-deduplicate-departures'].state).toBe('FAILED');
    expect(state.actionsState['download-deduplicate-departures'].msg).toBeTruthy();
  });

  test('an attempt that was never uploaded is a 404 with a readable message', async () => {
    const response = await get(`/api/v1/state?${Q}&application=getting-started&runId=999&attemptId=1`);
    expect(response.statusCode).toBe(404);
    // fetchAPI_rest builds its error from json.message || json.detail.
    expect(response.json().detail).toContain('999');
  });
});

describe('the two lookups the REST fetcher leaves unimplemented', () => {
  test('runs by action returns only the attempts that action took part in', async () => {
    const runs = await json(
      `/api/v1/runs/byAction?${Q}&name=download-deduplicate-departures`,
    );
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) expect(run.actions['download-deduplicate-departures']).toBeDefined();
  });

  test('runs by data object returns attempts that read or wrote it, each once', async () => {
    const runs = await json(`/api/v1/runs/byDataObject?${Q}&name=int-airports`);
    expect(runs.length).toBeGreaterThan(0);
    const keys = runs.map((r: any) => `${r.runId}.${r.attemptId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('configuration', () => {
  test('the configuration is wrapped in a config field, as the SPA expects', async () => {
    const body = await json(`/api/v1/config?${Q}&version=${SEED_VERSION}`);
    expect(body.config).toBeDefined();
    expect(Object.keys(body.config.dataObjects).length).toBeGreaterThan(0);
    expect(Object.keys(body.config.actions).length).toBeGreaterThan(0);
  });

  test('the uploaded configuration comes back unchanged', async () => {
    const original = JSON.parse(
      await readFile(path.join(FIXTURES, 'exported/exportedConfig.json'), 'utf8'),
    );
    const body = await json(`/api/v1/config?${Q}&version=${SEED_VERSION}`);
    expect(body.config).toEqual(original);
  });

  test('versions lists what has been uploaded', async () => {
    expect(await json(`/api/v1/versions?${Q}`)).toEqual([SEED_VERSION]);
  });
});

describe('schema and statistics', () => {
  test('timestamps come back newest first, as numbers', async () => {
    const tstamps = await json(`/api/v1/dataobject/schema/int-airports/tstamps?${Q}`);
    expect(tstamps).toEqual([1710144919, 1702279427, 1702279395]);
  });

  test('statistics are wrapped in a stats field, as the SPA expects', async () => {
    const body = await json(`/api/v1/dataobject/stats/int-airports?${Q}&tstamp=1710144922`);
    expect(body.stats).toBeDefined();
  });

  test('a schema comes back as it was uploaded', async () => {
    const original = JSON.parse(
      await readFile(path.join(FIXTURES, 'shared/schema/int-airports.schema.1702279395.json'), 'utf8'),
    );
    expect(await json(`/api/v1/dataobject/schema/int-airports?${Q}&tstamp=1702279395`)).toEqual(
      original,
    );
  });
});

describe('descriptions', () => {
  test('markdown comes back as JSON with a content field', async () => {
    const body = await json(
      `/api/v1/descriptions/dataObjects/int-airports.md?${Q}&version=${SEED_VERSION}`,
    );
    expect(body.content).toContain('Airports');
  });

  test('the list carries the field names SDLB expects, snake_case and all', async () => {
    const entries = await json(`/api/v1/descriptions/list?${Q}&version=${SEED_VERSION}`);
    expect(entries.length).toBe(2);
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(['last_modified', 'name', 'size', 'type']);
      expect(entry.type).toBe('text/markdown');
      expect(entry.size).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(entry.last_modified))).toBe(false);
    }
  });

  test('"list" is not read as a filename', async () => {
    const entries = await json(`/api/v1/descriptions/list?${Q}&version=${SEED_VERSION}`);
    expect(Array.isArray(entries)).toBe(true);
  });

  test('a missing description is a 404, which the SPA treats as "none"', async () => {
    const response = await get(
      `/api/v1/descriptions/dataObjects/does-not-exist.md?${Q}&version=${SEED_VERSION}`,
    );
    expect(response.statusCode).toBe(404);
  });

  test('a filename cannot climb out of its version', async () => {
    const response = await get(
      `/api/v1/descriptions/..%2F..%2Fconfig%2Flatest%2FexportedConfig.json?${Q}&version=${SEED_VERSION}`,
    );
    expect(response.statusCode).toBe(400);
  });
});

describe('parameter validation follows the upstream contract', () => {
  test('a repo outside the allowed character class is rejected with 422', async () => {
    const response = await get('/api/v1/workflows?tenant=t&repo=with%20space&env=dev');
    expect(response.statusCode).toBe(422);
    // FastAPI's HTTPValidationError shape, which existing clients already handle.
    expect(Array.isArray(response.json().detail)).toBe(true);
  });

  test('a missing required parameter is rejected with 422', async () => {
    const response = await get('/api/v1/workflow?tenant=t&repo=getting-started&env=dev');
    expect(response.statusCode).toBe(422);
  });

  test('an over-long name is rejected with 422', async () => {
    const response = await get(`/api/v1/workflows?tenant=t&repo=${'x'.repeat(51)}&env=dev`);
    expect(response.statusCode).toBe(422);
  });
});

function byRunDescending(a: string, b: string): number {
  const [runA, attemptA] = a.split('.').map(Number);
  const [runB, attemptB] = b.split('.').map(Number);
  return runB - runA || attemptB - attemptA;
}
