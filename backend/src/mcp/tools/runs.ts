import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Scope } from '../../store/keys.js';
import * as runsService from '../../services/runs.js';
import * as diagnostics from '../../services/diagnostics.js';
import * as schemaStats from '../../services/schemaStats.js';
import { json, truncateList } from '../format.js';

/**
 * Run-analysis tools: "why did this break, and what changed".
 *
 * None of them ever returns a whole state file. get_run_summary lists only the
 * actions that did not succeed; the full detail of one action is get_action_result;
 * and diagnose_run composes the six calls an agent would otherwise make into one.
 */

export function registerRunTools(server: McpServer, scope: Scope): void {
  server.registerTool(
    'list_runs',
    {
      title: 'List run attempts',
      description:
        'Attempts, newest first. Narrow by workflow, or by an action or data object that took ' +
        'part in them. With no filter at all it lists the workflows instead, since there is no ' +
        'meaningful global run order across them.',
      inputSchema: z.object({
        workflow: z.string().optional(),
        actionId: z.string().optional(),
        dataObjectId: z.string().optional(),
        status: z.string().optional().describe('keep only attempts that ended in this state'),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    },
    async ({ workflow, actionId, dataObjectId, status, limit }) => {
      let attempts;
      if (actionId) attempts = await runsService.getRunsByElement(scope, 'action', actionId, limit);
      else if (dataObjectId)
        attempts = await runsService.getRunsByElement(scope, 'dataObject', dataObjectId, limit);
      else if (workflow) attempts = await runsService.getWorkflowRuns(scope, workflow, limit);
      else return json({ workflows: await runsService.getWorkflows(scope) });

      const filtered = status
        ? attempts.filter((a) => a.status?.toUpperCase() === status.toUpperCase())
        : attempts;

      return json({
        runs: filtered.map((a) => ({
          workflow: a.name,
          runId: a.runId,
          attemptId: a.attemptId,
          status: a.status,
          attemptStartTime: a.attemptStartTime,
          durationMillis: a.duration,
          feedSel: a.feedSel,
          actionsByState: a.actionsStatus,
        })),
      });
    },
  );

  server.registerTool(
    'get_run_summary',
    {
      title: 'Summarise one attempt',
      description:
        'Status counts, timings and the actions that did not succeed, with their messages and ' +
        'row counts. Successful actions are counted, not listed, so the result stays small ' +
        'however large the run was.',
      inputSchema: z.object({
        workflow: z.string(),
        runId: z.number().int(),
        attemptId: z.number().int().default(1),
      }),
    },
    async ({ workflow, runId, attemptId }) =>
      json(await diagnostics.runSummary(scope, workflow, runId, attemptId)),
  );

  server.registerTool(
    'get_action_result',
    {
      title: 'Get one action of one attempt in full',
      description:
        'Every phase timestamp, the complete exception message, and each output with its ' +
        'partition values and metrics.',
      inputSchema: z.object({
        workflow: z.string(),
        runId: z.number().int(),
        attemptId: z.number().int().default(1),
        action: z.string(),
      }),
    },
    async ({ workflow, runId, attemptId, action }) => {
      const result = await diagnostics.actionResult(scope, workflow, runId, attemptId, action);
      return json(
        result ?? { error: `Attempt ${runId}.${attemptId} of ${workflow} has no action "${action}"` },
      );
    },
  );

  server.registerTool(
    'compare_runs',
    {
      title: 'Compare two attempts',
      description:
        'Per-action differences in state, row count and duration between two attempts of the ' +
        'same workflow. The first thing to reach for when something worked yesterday and does ' +
        'not today. Only actions that actually differ are listed.',
      inputSchema: z.object({
        workflow: z.string(),
        runIdA: z.number().int(),
        attemptIdA: z.number().int().default(1),
        runIdB: z.number().int(),
        attemptIdB: z.number().int().default(1),
      }),
    },
    async ({ workflow, runIdA, attemptIdA, runIdB, attemptIdB }) => {
      const result = await diagnostics.compareRuns(
        scope,
        workflow,
        { runId: runIdA, attemptId: attemptIdA },
        { runId: runIdB, attemptId: attemptIdB },
      );
      return json({
        a: { runId: runIdA, attemptId: attemptIdA, status: result.summaryA.status },
        b: { runId: runIdB, attemptId: attemptIdB, status: result.summaryB.status },
        ...truncateList('deltas', result.deltas, 100),
      });
    },
  );

  server.registerTool(
    'diagnose_run',
    {
      title: 'Diagnose a failed attempt',
      description:
        'Everything worth knowing about why an attempt went wrong, in one call: the failing ' +
        'actions and their messages, which actions were only cancelled because of them, empty ' +
        'inputs, schema movement before the attempt, the configuration of each implicated ' +
        'action, and how those actions fared in recent attempts. Read-only - it proposes ' +
        'nothing and changes nothing.',
      inputSchema: z.object({
        workflow: z.string(),
        runId: z.number().int(),
        attemptId: z.number().int().default(1),
        version: z.string().optional().describe('configuration version to read the actions from'),
      }),
    },
    async ({ workflow, runId, attemptId, version }) =>
      json(await diagnostics.diagnoseRun(scope, workflow, runId, attemptId, version)),
  );

  server.registerTool(
    'get_dataobject_schema',
    {
      title: 'Get a recorded schema',
      description:
        'The schema of a data object as SDLB recorded it. Without a timestamp the newest is ' +
        'returned; call it with no dataObjectId argument value you are unsure of and use ' +
        'search_config first.',
      inputSchema: z.object({
        dataObjectId: z.string(),
        tstamp: z.number().int().optional(),
      }),
    },
    async ({ dataObjectId, tstamp }) => {
      const at = tstamp ?? (await schemaStats.tstampAt(scope, 'schema', dataObjectId));
      if (at === undefined) return json({ error: `No schema recorded for ${dataObjectId}` });
      return json({ dataObjectId, tstamp: at, ...(await schemaStats.getSchema(scope, dataObjectId, at)) });
    },
  );

  server.registerTool(
    'get_dataobject_stats',
    {
      title: 'Get recorded statistics',
      description: 'Row counts, sizes and column statistics of a data object, as SDLB recorded them.',
      inputSchema: z.object({
        dataObjectId: z.string(),
        tstamp: z.number().int().optional(),
      }),
    },
    async ({ dataObjectId, tstamp }) => {
      const at = tstamp ?? (await schemaStats.tstampAt(scope, 'stats', dataObjectId));
      if (at === undefined) return json({ error: `No statistics recorded for ${dataObjectId}` });
      const { stats } = await schemaStats.getStats(scope, dataObjectId, at);
      return json({ dataObjectId, tstamp: at, stats });
    },
  );

  server.registerTool(
    'diff_schema',
    {
      title: 'Compare two recorded schemas',
      description:
        'Which columns a data object gained, lost or retyped between two recordings. Schema ' +
        'drift is a common root cause and is invisible in the state file. With no timestamps, ' +
        'the two most recent recordings are compared.',
      inputSchema: z.object({
        dataObjectId: z.string(),
        tstampA: z.number().int().optional(),
        tstampB: z.number().int().optional(),
      }),
    },
    async ({ dataObjectId, tstampA, tstampB }) => {
      const all = await schemaStats.tstamps(scope, 'schema', dataObjectId);
      const b = tstampB ?? all[0];
      const a = tstampA ?? all[1];
      if (a === undefined || b === undefined) {
        return json({
          error: `${dataObjectId} has ${all.length} recorded schema(s); two are needed to compare`,
          available: all,
        });
      }

      const [schemaA, schemaB] = await Promise.all([
        schemaStats.getSchema(scope, dataObjectId, a),
        schemaStats.getSchema(scope, dataObjectId, b),
      ]);
      const columnsA = new Map((schemaA.schema ?? []).map((c) => [c.name, c]));
      const columnsB = new Map((schemaB.schema ?? []).map((c) => [c.name, c]));

      const added = [...columnsB.keys()].filter((n) => !columnsA.has(n));
      const removed = [...columnsA.keys()].filter((n) => !columnsB.has(n));
      const retyped = [...columnsB.entries()]
        .filter(([name, column]) => {
          const before = columnsA.get(name);
          return before && JSON.stringify(before.dataType) !== JSON.stringify(column.dataType);
        })
        .map(([name, column]) => ({
          name,
          from: columnsA.get(name)!.dataType,
          to: column.dataType,
        }));

      return json({ dataObjectId, from: a, to: b, added, removed, retyped });
    },
  );
}
