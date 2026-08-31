import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { bundle, EXTERNAL } from '../../scripts/bundle.js';

/**
 * The deployed artefact, not the source.
 *
 * "It compiled" is not "it runs": bundling a Node service is where pino, Fastify's
 * plugin loading and the Azure SDKs historically break, and none of that shows up
 * until the bundle is executed. So this builds with the production configuration and
 * runs the result - in a separate plain-Node process, because vitest resolves
 * modules through its own runner and importing the bundle here would test Vite's
 * module graph rather than what Azure executes.
 *
 * See test/bundle/harness.mjs for what that process does.
 */

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.resolve(here, '../bundle/harness.mjs');

interface Reply {
  status: number;
  body: string;
}
interface Result {
  registered: { name: string; route: string; methods: string[]; authLevel: string }[];
  health?: Reply;
  rest?: Reply;
  validation?: Reply;
  mcp?: Reply;
}

let result: Result;
let metafile: Awaited<ReturnType<typeof bundle>>['metafile'];
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'sdlb-bundle-'));
  ({ metafile } = await bundle({ outdir: dir, sourcemap: false }));

  const { stdout } = await run(process.execPath, [HARNESS, path.join(dir, 'http.js')], {
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  const match = /__RESULT__(.*)__RESULT__/s.exec(stdout);
  if (!match) throw new Error(`the harness printed no result:\n${stdout}`);
  result = JSON.parse(match[1]) as Result;
}, 180_000);

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('the bundled entry point', () => {
  test('registers the catch-all and the root, for every method', () => {
    expect(result.registered.map((r) => r.name).sort()).toEqual(['catchAll', 'root']);

    const catchAll = result.registered.find((r) => r.name === 'catchAll')!;
    expect(catchAll.route).toBe('{*path}');
    expect(catchAll.authLevel).toBe('anonymous');
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
      expect(catchAll.methods).toContain(method);
    }
    // A wildcard does not match an empty segment, which is why root exists separately.
    expect(result.registered.find((r) => r.name === 'root')!.route).toBe('');
  });

  test('Fastify survives bundling and answers through it', () => {
    expect(result.health!.status).toBe(200);
    expect(JSON.parse(result.health!.body)).toEqual({ status: 'ok' });
  });

  test('the Azure storage SDKs are reachable through the bundle', () => {
    // Reaching Table Storage at all is the point; an empty repository is fine.
    expect(result.rest!.status, result.rest!.body).toBe(200);
    expect(JSON.parse(result.rest!.body)).toEqual([]);
  });

  test('the route schemas were not tree-shaken away', () => {
    expect(result.validation!.status).toBe(422);
  });

  test('the lazily split MCP chunk is found, imported and served', () => {
    // A missing or broken chunk surfaces as a 500 from the entry point's catch.
    expect(result.mcp!.status, result.mcp!.body).toBeLessThan(500);
    expect(result.mcp!.body).toContain('jsonrpc');
  });
});

describe('what the bundle contains', () => {
  const inputsOf = () =>
    Object.values(metafile.outputs).flatMap((output) => Object.keys(output.inputs));

  test('the Functions library is left to node_modules, not inlined', () => {
    // It reaches for @azure/functions-core, which only the host provides at runtime.
    for (const external of EXTERNAL) {
      expect(inputsOf().some((i) => i.includes(`node_modules/${external}/`))).toBe(false);
    }
  });

  test('everything else is inlined', () => {
    for (const inlined of ['fastify', '@azure/data-tables', '@azure/storage-blob']) {
      expect(
        inputsOf().some((i) => i.includes(`node_modules/${inlined}/`)),
        `${inlined} was not bundled`,
      ).toBe(true);
    }
  });

  test('the MCP dependencies stay out of the entry chunk', () => {
    // If these leak into the entry, every SDLB upload pays to parse them again.
    expect(eagerInputs()).not.toContain('node_modules/@modelcontextprotocol/');
    expect(eagerInputs()).not.toContain('node_modules/zod/');
  });

  /**
   * No store driver may be parsed before something asks for one.
   *
   * The point is dependency isolation: a deployment on the local backend should not parse
   * the Azure SDKs, and an Azure one should not parse node:sqlite. Measured, it also takes
   * 670 kB and about 35 ms off the path to the first response - though not off the path to
   * the first *upload*, which needs a driver and pays the chunk load then instead.
   */
  test('no store driver is parsed before a request needs one', () => {
    const eager = eagerInputs();
    for (const driver of [
      'node_modules/@azure/data-tables/',
      'node_modules/@azure/storage-blob/',
      'src/store/drivers/sqlite/',
      'src/store/drivers/filesystem.ts',
    ]) {
      expect(eager, `${driver} is loaded eagerly`).not.toContain(driver);
    }
  });

  test('each driver is in a chunk of its own, so one cannot drag in another', () => {
    const chunkFor = (input: string) =>
      Object.entries(metafile.outputs).find(([, output]) =>
        Object.keys(output.inputs).some((i) => i.includes(input)),
      )?.[0];

    const tables = chunkFor('node_modules/@azure/data-tables/');
    const sqlite = chunkFor('src/store/drivers/sqlite/db.ts');
    expect(tables).toBeDefined();
    expect(sqlite).toBeDefined();
    expect(sqlite).not.toBe(tables);
  });
});

/**
 * Everything reachable from the entry point by static import, transitively - which is
 * what a cold start parses before it can answer anything. A chunk reached only by a
 * dynamic import is not in here.
 */
function eagerInputs(): string {
  const staticImportsOf = (file: string): string[] =>
    (metafile.outputs[file]?.imports ?? [])
      .filter((i) => i.kind !== 'dynamic-import')
      .map((i) => i.path);

  const seen = new Set<string>();
  const queue = [Object.keys(metafile.outputs).find((f) => f.endsWith('http.js'))!];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...staticImportsOf(file));
  }
  return [...seen].flatMap((f) => Object.keys(metafile.outputs[f]?.inputs ?? {})).join('\n');
}
