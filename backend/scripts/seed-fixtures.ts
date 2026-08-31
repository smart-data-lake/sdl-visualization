import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

/**
 * Push the repository's end-to-end fixtures through the upload API.
 *
 * The fixtures under tests/e2e/fixtures are a pinned copy of the getting-started
 * project, and they are the only realistic corpus this project has: five attempts
 * of one workflow, one of which genuinely failed, three timestamped schema and
 * statistics recordings, and two descriptions. Seeding through the real endpoints
 * rather than writing storage directly is deliberate - it means the conformance
 * suite exercises ingest and read together, the way SDLB and the SPA do.
 *
 * Run against Azurite: `yarn azurite` in one terminal, `yarn seed` in another.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.resolve(here, '../../tests/e2e/fixtures');

export const SEED_SCOPE = { tenant: 'PrivateTenant', repo: 'getting-started', env: 'dev' };
export const SEED_VERSION = 'latest';

function query(extra: Record<string, string | number> = {}): string {
  const params = new URLSearchParams({ ...SEED_SCOPE, ...mapValues(extra) });
  return params.toString();
}

function mapValues(values: Record<string, string | number>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]));
}

interface Injection {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  payload?: unknown;
  headers?: Record<string, string>;
}

async function expectOk(app: FastifyInstance, options: Injection, what: string) {
  const response = await app.inject(options as never);
  if (response.statusCode >= 300) {
    throw new Error(`${what} failed: ${response.statusCode} ${response.body}`);
  }
  return response;
}

export async function seedFixtures(app: FastifyInstance): Promise<void> {
  await seedConfig(app);
  await seedStates(app);
  await seedSchemaAndStats(app);
  await seedDescriptions(app);
}

async function seedConfig(app: FastifyInstance): Promise<void> {
  const config = JSON.parse(
    await readFile(path.join(FIXTURES, 'exported/exportedConfig.json'), 'utf8'),
  );
  await expectOk(
    app,
    {
      method: 'PUT',
      url: `/api/v1/config?${query({ version: SEED_VERSION })}`,
      payload: config,
    },
    'config upload',
  );
}

async function seedStates(app: FastifyInstance): Promise<void> {
  const dir = path.join(FIXTURES, 'shared/state/succeeded');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const stateFile = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    await expectOk(
      app,
      { method: 'POST', url: `/api/v1/state?${query()}`, payload: stateFile },
      `state upload ${file}`,
    );
  }
}

/** Fixture filenames are "{dataObjectId}.{schema|stats}.{tstamp}.json". */
const SCHEMA_FILE = /^(.+)\.(schema|stats)\.(\d+)\.json$/;

async function seedSchemaAndStats(app: FastifyInstance): Promise<void> {
  const dir = path.join(FIXTURES, 'shared/schema');
  for (const file of (await readdir(dir)).sort()) {
    const match = SCHEMA_FILE.exec(file);
    if (!match) continue; // the .index files are the local backend's own listing
    const [, dataObjectId, subtype, tstamp] = match;
    const body = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    await expectOk(
      app,
      {
        method: 'PUT',
        url: `/api/v1/dataobject/${subtype}/${dataObjectId}?${query({ tstamp })}`,
        payload: body,
      },
      `${subtype} upload ${file}`,
    );
  }
}

async function seedDescriptions(app: FastifyInstance): Promise<void> {
  const root = path.join(FIXTURES, 'shared/description');
  for (const file of await walk(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const body = await readFile(file);
    await expectOk(
      app,
      {
        method: 'POST',
        url: `/api/v1/descriptions/${relative}?${query({ version: SEED_VERSION })}`,
        payload: body,
        headers: { 'content-type': 'application/octet-stream' },
      },
      `description upload ${relative}`,
    );
  }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : Promise.resolve([full]);
    }),
  );
  return files.flat().sort();
}

/**
 * Standalone entry point. Seeds the local store by default; point it at a running Azurite
 * with SDLB_STORAGE_BACKEND=azure, or at a real account with SDLB_STORAGE_ACCOUNT.
 */
if (process.argv[1] && process.argv[1].endsWith('seed-fixtures.ts')) {
  process.env.SDLB_STORAGE_BACKEND ??= 'local';
  process.env.SDLB_AUTH_MODE ??= 'disabled';
  const { buildFastify } = await import('../src/app.js');
  const app = await buildFastify();
  await seedFixtures(app);
  await app.close();
  console.log(`Seeded ${SEED_SCOPE.repo}/${SEED_SCOPE.env} from ${FIXTURES}`);
}
