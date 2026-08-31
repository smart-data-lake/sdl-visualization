import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { buildFastify } from '../../src/app.js';
import { useTempStore } from '../setup/store.js';
import { SEED_SCOPE, seedFixtures } from '../../scripts/seed-fixtures.js';
import { closeMcpHandler, handleMcpRequest } from '../../src/mcp/handler.js';

/**
 * The MCP endpoint, driven by a real MCP client.
 *
 * No socket: the client's fetch is pointed straight at handleMcpRequest, which is
 * the same entry point the Function calls, so the protocol handling, the auth path
 * and the tools are all exercised without a server in between.
 *
 * The assertions are as much about size as about content. Output size is a design
 * property of an MCP server - a tool that returns a whole state file costs its
 * caller more context than the answer is worth - so the tests that pin it are the
 * ones that stop it regressing.
 */

const BASE = `http://mcp.test/mcp/${SEED_SCOPE.repo}/${SEED_SCOPE.env}`;

let app: FastifyInstance;
let client: Client;

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const result: any = await client.callTool({ name, arguments: args });
  const text = (result.content ?? [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n');
  return { raw: result, text, value: JSON.parse(text) };
}

let store: Awaited<ReturnType<typeof useTempStore>>;

beforeAll(async () => {
  store = await useTempStore();
  app = await buildFastify();
  await seedFixtures(app);

  const transport = new StreamableHTTPClientTransport(new URL(BASE), {
    // Straight into the handler the Azure Function dispatches to.
    fetch: (input: any, init?: any) => handleMcpRequest(new Request(input, init)),
  });
  client = new Client({ name: 'conformance-test', version: '0.0.0' });
  await client.connect(transport);
});

afterAll(async () => {
  await client?.close();
  await closeMcpHandler();
  await app?.close();
  await store?.cleanup();
});

describe('the tool surface', () => {
  test('every tool is listed with a description', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual([
      'compare_runs',
      'diagnose_run',
      'diff_schema',
      'find_similar_dataobjects',
      'get_action_result',
      'get_config_element',
      'get_dataobject_schema',
      'get_dataobject_stats',
      'get_lineage',
      'get_run_summary',
      'list_config_patterns',
      'list_runs',
      'list_scopes',
      'search_config',
    ]);

    for (const tool of tools) {
      expect(tool.description, `${tool.name} has no description`).toBeTruthy();
      expect(tool.inputSchema, `${tool.name} has no input schema`).toBeTruthy();
    }
  });

  test('no tool writes anything', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.name).not.toMatch(/^(create|update|delete|set|put|write|apply)_/);
    }
  });
});

describe('discovery', () => {
  test('search_config finds by id, case insensitively', async () => {
    const { value } = await callTool('search_config', { query: 'AIRPORTS', searchType: 'id' });
    expect(value.hits.map((h: any) => h.id)).toContain('int-airports');
    expect(value.hits[0]).toHaveProperty('source'); // file:line, for the agent to open
  });

  test('search_config understands the property syntax', async () => {
    const { value } = await callTool('search_config', {
      query: 'type:DeltaLake',
      searchType: 'property',
    });
    expect(value.hits.length).toBeGreaterThan(0);
    for (const hit of value.hits) expect(hit.type).toMatch(/DeltaLake/);
  });

  test('search_config understands feed selectors', async () => {
    const { value } = await callTool('search_config', { query: 'compute', searchType: 'feedSel' });
    expect(value.hits.map((h: any) => h.id)).toContain('compute-distances');
  });

  test('get_config_element answers with the element, its neighbours and its last run', async () => {
    const { value } = await callTool('get_config_element', { id: 'int-airports' });
    expect(value.kind).toBe('dataObjects');
    expect(value.element.type).toBe('DeltaLakeTableDataObject');
    expect(value.neighbours.upstream).toContain('historize-airports');
    expect(value.lastRun.state).toBeTruthy();
    expect(value.description).toContain('Airports');
  });

  test('list_config_patterns groups the repository conventions', async () => {
    const { value } = await callTool('list_config_patterns', {
      kind: 'dataObjects',
      groupBy: 'type',
    });
    expect(value.groups.length).toBeGreaterThan(0);
    expect(value.groups[0]).toHaveProperty('count');
    expect(value.groups[0].examples.length).toBeGreaterThan(0);
    // sorted by how common the pattern is, so the house style comes first
    const counts = value.groups.map((g: any) => g.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  test('find_similar_dataobjects proposes the ones sharing a type and layer', async () => {
    const { value } = await callTool('find_similar_dataobjects', { id: 'int-airports' });
    expect(value.hits.length).toBeGreaterThan(0);
    expect(value.hits.map((h: any) => h.id)).not.toContain('int-airports');
  });

  test('get_lineage returns a compact edge list, and says which data object each edge is', async () => {
    const { value } = await callTool('get_lineage', {
      id: 'compute-distances',
      view: 'action',
      direction: 'both',
      depth: 3,
    });
    expect(value.nodes).toContain('compute-distances');
    expect(value.edges.length).toBeGreaterThan(0);
    expect(value.edges[0]).toHaveProperty('via');
  });

  test('asking for lineage of something that is not in that view says so', async () => {
    const { value } = await callTool('get_lineage', { id: 'compute-distances', view: 'data' });
    expect(value.error).toContain('compute-distances');
    expect(value.hint).toBeTruthy();
  });
});

describe('run analysis', () => {
  test('list_runs with no filter lists the workflows instead of guessing', async () => {
    const { value } = await callTool('list_runs');
    expect(value.workflows[0].name).toBe('getting-started');
  });

  test('list_runs by action returns only that action attempts, newest first', async () => {
    const { value } = await callTool('list_runs', { actionId: 'compute-distances', limit: 5 });
    expect(value.runs.length).toBeGreaterThan(0);
    const ordered = value.runs.map((r: any) => r.runId);
    expect(ordered).toEqual([...ordered].sort((a: number, b: number) => b - a));
  });

  test('get_run_summary lists the problems and only counts the successes', async () => {
    const { value, text } = await callTool('get_run_summary', {
      workflow: 'getting-started',
      runId: 24,
      attemptId: 1,
    });

    expect(value.status).toBe('FAILED');
    expect(value.numActions).toBe(5);
    expect(value.actionsByState).toEqual({ SUCCEEDED: 2, FAILED: 1, CANCELLED: 2 });
    expect(value.problems.map((p: any) => p.action)).toEqual([
      'download-deduplicate-departures', // FAILED sorts first
      'compute-distances',
      'join-departures-airports',
    ]);
    // the successful actions are not listed at all
    expect(text).not.toContain('download-airports');
  });

  test('a summary stays small even though the state file is not', async () => {
    const { text } = await callTool('get_run_summary', {
      workflow: 'getting-started',
      runId: 24,
      attemptId: 1,
    });
    const stateFile = await app.inject({
      method: 'GET',
      url: `/api/v1/state?${new URLSearchParams(SEED_SCOPE)}&application=getting-started&runId=24&attemptId=1`,
    });
    expect(text.length).toBeLessThan(stateFile.body.length);
  });

  test('get_action_result gives one action in full', async () => {
    const { value } = await callTool('get_action_result', {
      workflow: 'getting-started',
      runId: 24,
      attemptId: 1,
      action: 'download-deduplicate-departures',
    });
    expect(value.state).toBe('FAILED');
    expect(value.message).toBeTruthy();
    expect(value.phases.exec).toBeDefined();
  });

  test('compare_runs reports only what differs', async () => {
    const { value } = await callTool('compare_runs', {
      workflow: 'getting-started',
      runIdA: 24,
      attemptIdA: 1,
      runIdB: 75,
      attemptIdB: 1,
    });
    expect(value.a.status).toBe('FAILED');
    expect(value.b.status).toBe('SUCCEEDED');
    expect(value.deltas.length).toBeGreaterThan(0);
    for (const delta of value.deltas) expect(delta.changed.length).toBeGreaterThan(0);
  });

  test('diagnose_run blames the failure and explains the cancellations', async () => {
    const { value } = await callTool('diagnose_run', {
      workflow: 'getting-started',
      runId: 24,
      attemptId: 1,
    });

    const failed = value.findings.filter((f: any) => f.kind === 'action-failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].action).toBe('download-deduplicate-departures');
    expect(failed[0].detail).toBeTruthy();

    const cancelled = value.findings.filter((f: any) => f.kind === 'cancelled-downstream');
    expect(cancelled.map((f: any) => f.action).sort()).toEqual([
      'compute-distances',
      'join-departures-airports',
    ]);
    // the cancellations are traced back to the action that actually failed
    expect(cancelled.some((f: any) => f.detail.includes('download-deduplicate-departures'))).toBe(true);

    // the configuration of each implicated action comes along, so the agent need not fetch it
    expect(value.relevantConfig['download-deduplicate-departures']).toBeDefined();
    // and how the same action fared before
    expect(value.history['download-deduplicate-departures'].length).toBeGreaterThan(0);
  });
});

describe('schema tools', () => {
  test('get_dataobject_schema defaults to the newest recording', async () => {
    const { value } = await callTool('get_dataobject_schema', { dataObjectId: 'int-airports' });
    expect(value.tstamp).toBe(1710144919);
  });

  test('diff_schema compares the two most recent recordings by default', async () => {
    const { value } = await callTool('diff_schema', { dataObjectId: 'btl-distances' });
    expect(value.from).toBe(1702279427);
    expect(value.to).toBe(1710144919);
    expect(value).toHaveProperty('added');
    expect(value).toHaveProperty('removed');
    expect(value).toHaveProperty('retyped');
  });

  test('a data object with nothing recorded says so rather than failing', async () => {
    const { value } = await callTool('get_dataobject_stats', { dataObjectId: 'stg-airports' });
    expect(value.error).toContain('stg-airports');
  });
});

describe('scope', () => {
  test('the scope comes from the URL, so tools never ask for it', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const properties = Object.keys((tool.inputSchema as any).properties ?? {});
      expect(properties).not.toContain('repo');
      expect(properties).not.toContain('env');
      expect(properties).not.toContain('tenant');
    }
  });

  test('list_scopes reports the current scope and what else exists', async () => {
    const { value } = await callTool('list_scopes');
    expect(value.current).toEqual({ repo: SEED_SCOPE.repo, env: SEED_SCOPE.env });
    expect(value.available).toContainEqual({ repo: 'getting-started', envs: ['dev'] });
  });
});
