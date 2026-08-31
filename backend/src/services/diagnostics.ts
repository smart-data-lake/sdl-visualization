import type { Action, StateFile, TaskStatus } from '../domain/types.js';
import { durationMillis, endAnchorOf, writtenDataObjects } from '../domain/stateFile.js';
import { getMainInputCount, getMainOutputCount } from '../domain/metrics.js';
import { buildRunGraph } from '../domain/graph.js';
import type { Scope } from '../store/types.js';
import * as runs from './runs.js';
import * as config from './config.js';
import * as schemaStats from './schemaStats.js';

/**
 * Run analysis: the questions an agent asks about a failed run, answered by
 * composing the pieces server-side so one call replaces six.
 *
 * The guiding constraint is size. A state file with a few hundred actions is a
 * perfectly good thing to render a timeline from and a terrible thing to hand to a
 * language model, so nothing here ever returns one whole. Summaries carry only the
 * actions that did not succeed; the full detail of one action is a separate call.
 */

const UNFINISHED = new Set<TaskStatus>(['PENDING', 'PREPARING', 'PREPARED', 'INITIALIZING', 'INITIALIZED', 'RUNNING']);
const BAD = new Set<TaskStatus>(['FAILED', 'CANCELLED', 'SKIPPED']);

export interface ActionSummary {
  action: string;
  state: TaskStatus;
  durationMillis: number;
  inputIds: string[];
  outputIds: string[];
  recordsRead?: number;
  recordsWritten?: number;
  message?: string;
}

export interface RunSummary {
  workflow: string;
  runId: number;
  attemptId: number;
  status: TaskStatus;
  feedSel?: string;
  attemptStartTime?: string;
  runEndTime?: string;
  durationMillis?: number;
  numActions: number;
  actionsByState: Partial<Record<TaskStatus, number>>;
  /** Only the actions that did not succeed. The successful ones are a count, not a list. */
  problems: ActionSummary[];
  isFinal: boolean;
}

function summarizeAction(name: string, action: Action): ActionSummary {
  return {
    action: name,
    state: action.state,
    durationMillis: durationMillis(action.duration),
    inputIds: action.inputIds ?? [],
    outputIds: writtenDataObjects(action),
    recordsRead: getMainInputCount(action),
    recordsWritten: getMainOutputCount(action),
    message: action.msg,
  };
}

export async function runSummary(
  scope: Scope,
  workflow: string,
  runId: number,
  attemptId: number,
): Promise<RunSummary> {
  const stateFile = await runs.getRun(scope, workflow, runId, attemptId);
  return summarize(stateFile);
}

function summarize(stateFile: StateFile): RunSummary {
  const entries = Object.entries(stateFile.actionsState ?? {});
  const actionsByState: Partial<Record<TaskStatus, number>> = {};
  const problems: ActionSummary[] = [];

  for (const [name, action] of entries) {
    actionsByState[action.state] = (actionsByState[action.state] ?? 0) + 1;
    if (BAD.has(action.state)) problems.push(summarizeAction(name, action));
  }

  const start = stateFile.attemptStartTime ? Date.parse(stateFile.attemptStartTime) : undefined;
  const anchor = endAnchorOf(stateFile);

  return {
    workflow: stateFile.appConfig.applicationName,
    runId: stateFile.runId,
    attemptId: stateFile.attemptId,
    status: runs.aggregateRunStatus(Object.values(stateFile.actionsState ?? {})),
    feedSel: stateFile.appConfig.feedSel,
    attemptStartTime: stateFile.attemptStartTime,
    runEndTime: stateFile.runEndTime,
    durationMillis: start !== undefined && anchor !== undefined ? anchor - start : undefined,
    numActions: entries.length,
    actionsByState,
    problems: problems.sort(byBadnessThenName),
    isFinal: anchor !== undefined,
  };
}

function byBadnessThenName(a: ActionSummary, b: ActionSummary): number {
  const rank = (s: TaskStatus) => (s === 'FAILED' ? 0 : s === 'CANCELLED' ? 1 : 2);
  return rank(a.state) - rank(b.state) || a.action.localeCompare(b.action);
}

/** One action in full: every phase, the complete message, and per-output metrics. */
export async function actionResult(
  scope: Scope,
  workflow: string,
  runId: number,
  attemptId: number,
  actionId: string,
): Promise<{
  action: string;
  state: TaskStatus;
  phases: Record<string, { start?: string; end?: string }>;
  duration: string;
  message?: string;
  inputIds: string[];
  outputs: {
    dataObjectId: string;
    partitionValues: unknown[];
    isSkipped?: boolean;
    metrics?: Record<string, unknown>;
  }[];
} | undefined> {
  const stateFile = await runs.getRun(scope, workflow, runId, attemptId);
  const action = stateFile.actionsState?.[actionId];
  if (!action) return undefined;

  return {
    action: actionId,
    state: action.state,
    phases: {
      prepare: { start: action.startTstmpPrepare, end: action.endTstmpPrepare },
      init: { start: action.startTstmpInit, end: action.endTstmpInit },
      exec: { start: action.startTstmp, end: action.endTstmp },
    },
    duration: action.duration,
    message: action.msg,
    inputIds: action.inputIds ?? [],
    outputs: (action.results ?? []).map((result) => ({
      dataObjectId: result.dataObjectId,
      partitionValues: result.partitionValues ?? [],
      isSkipped: result.isSkipped,
      metrics: result.metrics as Record<string, unknown> | undefined,
    })),
  };
}

/* ------------------------------------------------------------------ comparing */

export interface ActionDelta {
  action: string;
  stateA?: TaskStatus;
  stateB?: TaskStatus;
  durationMillisA?: number;
  durationMillisB?: number;
  recordsWrittenA?: number;
  recordsWrittenB?: number;
  changed: string[];
}

/**
 * What differs between two attempts of the same workflow. The single most useful
 * thing to know when something worked yesterday and does not today, and cheap to
 * compute because both sides are already normalised.
 */
export async function compareRuns(
  scope: Scope,
  workflow: string,
  a: { runId: number; attemptId: number },
  b: { runId: number; attemptId: number },
): Promise<{ summaryA: RunSummary; summaryB: RunSummary; deltas: ActionDelta[] }> {
  const [stateA, stateB] = await Promise.all([
    runs.getRun(scope, workflow, a.runId, a.attemptId),
    runs.getRun(scope, workflow, b.runId, b.attemptId),
  ]);

  const names = new Set([
    ...Object.keys(stateA.actionsState ?? {}),
    ...Object.keys(stateB.actionsState ?? {}),
  ]);

  const deltas: ActionDelta[] = [];
  for (const name of [...names].sort()) {
    const actionA = stateA.actionsState?.[name];
    const actionB = stateB.actionsState?.[name];
    const delta: ActionDelta = {
      action: name,
      stateA: actionA?.state,
      stateB: actionB?.state,
      durationMillisA: actionA ? durationMillis(actionA.duration) : undefined,
      durationMillisB: actionB ? durationMillis(actionB.duration) : undefined,
      recordsWrittenA: getMainOutputCount(actionA),
      recordsWrittenB: getMainOutputCount(actionB),
      changed: [],
    };
    if (delta.stateA !== delta.stateB) delta.changed.push('state');
    if (delta.recordsWrittenA !== delta.recordsWrittenB) delta.changed.push('recordsWritten');
    if (significantlySlower(delta.durationMillisA, delta.durationMillisB)) {
      delta.changed.push('duration');
    }
    if (delta.changed.length > 0) deltas.push(delta);
  }

  return { summaryA: summarize(stateA), summaryB: summarize(stateB), deltas };
}

/** Runtime always wobbles; only report a difference big enough to be worth a look. */
function significantlySlower(a?: number, b?: number): boolean {
  if (a === undefined || b === undefined) return a !== b;
  if (Math.abs(a - b) < 1_000) return false;
  const larger = Math.max(a, b);
  const smaller = Math.max(Math.min(a, b), 1);
  return larger / smaller >= 1.5;
}

/* ------------------------------------------------------------------ diagnosing */

export interface Finding {
  kind:
    | 'action-failed'
    | 'cancelled-downstream'
    | 'skipped'
    | 'no-data'
    | 'schema-changed'
    | 'run-unfinished';
  action?: string;
  dataObjectId?: string;
  detail: string;
}

export interface Diagnosis {
  summary: RunSummary;
  findings: Finding[];
  /** The configuration of every action named in a finding, so the agent need not fetch them. */
  relevantConfig: Record<string, unknown>;
  /** How the same actions fared in the attempts before this one. */
  history: Record<string, { runId: number; attemptId: number; state: TaskStatus }[]>;
}

/**
 * Everything worth knowing about why an attempt went wrong, in one call: which
 * actions failed and why, which ones were only cancelled because of them, whether
 * an input arrived empty, whether a schema moved since the last success, and how
 * the same actions behaved recently.
 */
export async function diagnoseRun(
  scope: Scope,
  workflow: string,
  runId: number,
  attemptId: number,
  version?: string,
): Promise<Diagnosis> {
  const stateFile = await runs.getRun(scope, workflow, runId, attemptId);
  const summary = summarize(stateFile);
  const actionsState = stateFile.actionsState ?? {};
  const findings: Finding[] = [];

  const failed = Object.entries(actionsState).filter(([, a]) => a.state === 'FAILED');
  for (const [name, action] of failed) {
    findings.push({
      kind: 'action-failed',
      action: name,
      detail: action.msg?.split('\n')[0] ?? 'failed without a message',
    });
  }

  // An action graph built from the run itself, so "what was downstream of the
  // failure" is answered by what actually ran, not by what the config says.
  const graph = buildRunGraph(
    Object.entries(actionsState).map(([action, a]) => ({
      action,
      inputIds: a.inputIds ?? [],
      outputIds: writtenDataObjects(a),
    })),
  ).getActionGraph();

  const failedNames = new Set(failed.map(([name]) => name));
  for (const [name, action] of Object.entries(actionsState)) {
    if (action.state !== 'CANCELLED') continue;
    const node = graph.getNodeById(name);
    const blamed = node
      ? graph.getAncestors(node).filter((a) => failedNames.has(a.id)).map((a) => a.id)
      : [];
    findings.push({
      kind: 'cancelled-downstream',
      action: name,
      detail: blamed.length
        ? `cancelled after ${blamed.join(', ')} failed upstream`
        : 'cancelled, with no failed action upstream of it in this run',
    });
  }

  for (const [name, action] of Object.entries(actionsState)) {
    if (action.state === 'SKIPPED') {
      findings.push({
        kind: 'skipped',
        action: name,
        detail: action.msg?.split('\n')[0] ?? 'skipped, typically by an execution condition or mode',
      });
    }
    for (const result of action.results ?? []) {
      if (result.metrics?.no_data === true) {
        findings.push({
          kind: 'no-data',
          action: name,
          dataObjectId: result.dataObjectId,
          detail: `${name} produced no data for ${result.dataObjectId}`,
        });
      }
    }
  }

  if (!summary.isFinal) {
    findings.push({
      kind: 'run-unfinished',
      detail: 'this attempt never recorded an end; it may still be running or have been killed',
    });
  }

  // Schema drift is invisible in the state file and a common root cause, so check
  // the inputs of the failing actions against the attempt's own start time.
  const attemptMillis = stateFile.attemptStartTime ? Date.parse(stateFile.attemptStartTime) : undefined;
  if (attemptMillis !== undefined) {
    const inputs = new Set(failed.flatMap(([, a]) => a.inputIds ?? []));
    for (const dataObjectId of inputs) {
      const all = await schemaStats.tstamps(scope, 'schema', dataObjectId);
      const changedRecently = all.filter((t) => t <= attemptMillis && t > attemptMillis - 30 * 86_400_000);
      if (changedRecently.length > 1) {
        findings.push({
          kind: 'schema-changed',
          dataObjectId,
          detail: `the schema of ${dataObjectId} was recorded ${changedRecently.length} times in the 30 days before this attempt`,
        });
      }
    }
  }

  const named = [...new Set(findings.map((f) => f.action).filter((a): a is string => !!a))];

  const relevantConfig: Record<string, unknown> = {};
  try {
    const resolved = await config.resolveVersion(scope, version);
    for (const name of named) {
      const element = await config.getElement(scope, resolved, name, 'actions');
      if (element) relevantConfig[name] = element.element;
    }
  } catch {
    // A run can be uploaded without its configuration ever having been; the
    // diagnosis is still worth returning without it.
  }

  const history: Diagnosis['history'] = {};
  for (const name of named) {
    const rows = await runs.getElementHistory(scope, 'action', name, 6);
    history[name] = rows
      .filter((r) => !(r.runId === runId && r.attemptId === attemptId))
      .map((r) => ({ runId: r.runId, attemptId: r.attemptId, state: r.state }));
  }

  return { summary, findings, relevantConfig, history };
}

export { UNFINISHED };
