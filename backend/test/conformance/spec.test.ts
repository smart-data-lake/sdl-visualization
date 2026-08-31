import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildFastify } from '../../src/app.js';
import { useTempStore } from '../setup/store.js';
import { SEED_SCOPE, SEED_VERSION, seedFixtures } from '../../scripts/seed-fixtures.js';

/**
 * Every operation of the upstream contract is routed, and validates its parameters.
 *
 * The spec pins paths, methods and parameter constraints; those are the parts worth
 * machine-checking, and a typo in a route or a dropped `pattern` should fail the
 * build rather than production. Response shapes are not checked here because the
 * spec does not describe them - that is rest.test.ts's job.
 *
 * /users and /license are the two deliberate omissions: a deployment serves one
 * tenant whose access is decided by its Databricks workspace, so there is no user
 * directory to manage and nothing to meter. The test asserts they are gone rather
 * than letting them quietly rot.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const SPEC = path.resolve(here, '../../spec/upstream-openapi.json');

export const OMITTED = ['/api/v1/users', '/api/v1/license'];

interface Spec {
  paths: Record<string, Record<string, { parameters?: { name: string; in: string }[] }>>;
}

/** Values that satisfy every constraint the spec declares, for the seeded fixture data. */
const SAMPLE: Record<string, string> = {
  tenant: SEED_SCOPE.tenant,
  repo: SEED_SCOPE.repo,
  env: SEED_SCOPE.env,
  application: 'getting-started',
  runId: '24',
  attemptId: '1',
  actionId: 'compute-distances',
  version: SEED_VERSION,
  tstamp: '1702279395',
  dataObjectId: 'int-airports',
  filename: 'dataObjects/int-airports.md',
  email: 'someone@example.com',
};

// Read synchronously at module load: vitest builds a test.each table at collection
// time, before any hook has run.
const spec = JSON.parse(readFileSync(SPEC, 'utf8')) as Spec;

let app: FastifyInstance;

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

function operations(): { method: string; specPath: string; url: string }[] {
  return Object.entries(spec.paths).flatMap(([specPath, methods]) =>
    Object.entries(methods)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([method, operation]) => {
        let url = specPath;
        const query = new URLSearchParams();
        for (const parameter of operation.parameters ?? []) {
          const value = SAMPLE[parameter.name] ?? 'x';
          if (parameter.in === 'path') {
            url = url.replace(`{${parameter.name}}`, encodeURI(value));
          } else if (parameter.in === 'query') {
            query.set(parameter.name, value);
          }
        }
        const search = query.toString();
        return { method: method.toUpperCase(), specPath, url: search ? `${url}?${search}` : url };
      }),
  );
}

describe('the upstream contract', () => {
  test('the spec still declares the 25 operations this service was built against', () => {
    expect(operations()).toHaveLength(25);
  });

  test.each(operations().map((o) => [o.method, o.specPath] as [string, string]))(
    '%s %s is routed',
    async (method, specPath) => {
      const operation = operations().find((o) => o.method === method && o.specPath === specPath)!;
      const response = await app.inject({
        method: operation.method as never,
        url: operation.url,
        payload: needsBody(method) ? {} : undefined,
      });

      if (OMITTED.some((omitted) => specPath.startsWith(omitted))) {
        expect(response.statusCode, `${specPath} should be omitted`).toBe(404);
        return;
      }

      // Anything but "no such route" and "wrong method" means the operation exists.
      // A 4xx from validation or from missing data is fine; it still proves routing.
      expect([404, 405]).not.toContain(response.statusCode);
      expect(response.statusCode, `${method} ${operation.url} -> ${response.body}`).toBeLessThan(500);
    },
  );
});

describe('parameter constraints are enforced as the spec declares them', () => {
  const cases: [string, string][] = [
    ['a repo with a space', '/api/v1/workflows?tenant=t&repo=a%20b&env=dev'],
    ['a repo over 50 characters', `/api/v1/workflows?tenant=t&repo=${'x'.repeat(51)}&env=dev`],
    ['a non-numeric runId', '/api/v1/state?tenant=t&repo=r&env=e&application=a&runId=abc&attemptId=1'],
    ['a non-integer tstamp', '/api/v1/dataobject/schema/x?tenant=t&repo=r&env=e&tstamp=1.5'],
    ['a missing env', '/api/v1/workflows?tenant=t&repo=r'],
  ];

  test.each(cases)('%s is rejected with 422', async (_name, url) => {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(422);
    expect(Array.isArray(response.json().detail)).toBe(true);
  });
});

function needsBody(method: string): boolean {
  return ['post', 'put', 'patch'].includes(method.toLowerCase());
}
