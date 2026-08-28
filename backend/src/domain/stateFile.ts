import type { Action, StateFile, TaskStatus, WorkflowRun, WorkflowRunAction } from './types.js';
import { getMainInputCount, getMainOutputCount } from './metrics.js';

/**
 * Everything that turns a raw SDLB state file into the records this service stores and serves.
 *
 * The index record it produces is a port of build_index.py's getRuns() - the same status
 * priority, the same runEndTime derivation and the same actions map - because that script is
 * the existing, working specification of what the SPA expects from a state index. The
 * precalculated fields the local backend adds afterwards in getIndex() (duration,
 * actionsStatus, dataObjects) are computed here instead, at ingest.
 */

const PHASE_TIMESTAMPS = [
  'startTstmpPrepare',
  'endTstmpPrepare',
  'startTstmpInit',
  'endTstmpInit',
  'startTstmp',
  'endTstmp',
] as const;

/**
 * Status priority for aggregating a run's actions into one status.
 *
 * This is build_index.py's order, not the frontend's row.ts order, and the two genuinely
 * disagree: row.ts ranks anything in progress above anything settled, so a run with one
 * FAILED and one RUNNING action aggregates to RUNNING there and to FAILED here. We follow
 * the index, because WorkflowRun.status is an index field and every existing state index was
 * built this way.
 */
const RUN_STATUS_PRIORITY: TaskStatus[] = [
  'FAILED',
  'CANCELLED',
  'RUNNING',
  'SUCCEEDED',
  'SKIPPED',
  'INITIALIZING',
  'INITIALIZED',
  'PREPARING',
  'PREPARED',
  'PENDING',
];

/**
 * Bring an older state file up to the current format.
 * Ported from updateStateFile in src/util/WorkflowsExplorer/Attempt.ts. Applied once, at
 * ingest, so that nothing downstream - the SPA, the MCP tools, the stored index - ever has
 * to know about the old shapes.
 */
export function normalizeStateFile(data: any): StateFile {
  if (data?.actionsState) {
    for (const [name, value] of Object.entries<any>(data.actionsState)) {
      const action = value;
      // move attributes from results[].subFeed one level up, rename mainMetrics -> metrics,
      // and unwrap partitionValues[].elements
      if (action.results && action.results.length > 0 && action.results[0].subFeed) {
        action.results = action.results.map((result: any) => {
          const updated = { ...result, ...result.subFeed };
          delete updated.subFeed;
          updated.metrics = updated.mainMetrics;
          delete updated.mainMetrics;
          updated.partitionValues = (updated.partitionValues ?? []).map(
            (e: any) => e.elements || e,
          );
          return updated;
        });
      }
      // inputIds and outputIds used to be objects carrying an id
      if (action.inputIds?.length > 0 && action.inputIds[0].id) {
        action.inputIds = action.inputIds.map((e: any) => e.id || e);
      }
      if (action.outputIds?.length > 0 && action.outputIds[0].id) {
        action.outputIds = action.outputIds.map((e: any) => e.id || e);
      }
      data.actionsState[name] = action;
    }
  }
  return data as StateFile;
}

/** Milliseconds of an ISO-8601 duration such as "PT3.6266377S" or "PT1M30S". */
export function durationMillis(duration: string | undefined): number {
  if (!duration) return 0;
  const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
    duration,
  );
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  const total =
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return Math.floor(total * 1000);
}

function millis(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : t;
}

/** The ids of the data objects an action wrote, with the pre-outputIds fallback to its results. */
export function writtenDataObjects(action: Action): string[] {
  if (action.outputIds?.length) return action.outputIds;
  return (action.results ?? []).map((r) => r.dataObjectId).filter(Boolean);
}

/** One status standing in for all of a run's actions. */
export function aggregateRunStatus(actions: Iterable<Action>): TaskStatus {
  const present = new Set<string>();
  for (const action of actions) present.add((action.state || 'UNKNOWN').toUpperCase());
  return RUN_STATUS_PRIORITY.find((status) => present.has(status)) ?? 'UNKNOWN';
}

/**
 * When the attempt ended. Ported from build_index.py's getRunEndTime: the latest end
 * timestamp any action recorded, falling back to start + duration, and never earlier than
 * the attempt's own start.
 */
export function deriveRunEndTime(stateFile: StateFile): string | undefined {
  const attemptStart = millis(stateFile.attemptStartTime);
  if (attemptStart === undefined) return stateFile.runEndTime;

  let latest = attemptStart;
  for (const action of Object.values(stateFile.actionsState ?? {})) {
    const end = millis(action.endTstmp);
    if (end !== undefined) {
      latest = Math.max(latest, end);
      continue;
    }
    const start = millis(action.startTstmp);
    if (start !== undefined && action.duration) {
      latest = Math.max(latest, start + durationMillis(action.duration));
    }
  }
  return new Date(latest).toISOString();
}

/**
 * Where a phase that recorded no end timestamp is taken to stop.
 * Ported from endAnchorOf in Attempt.ts. Undefined while the attempt is in flight, so such a
 * phase keeps counting up; for a finalised attempt it is the last moment the state file has
 * any evidence for, so a cancelled action does not make a finished run look eternal.
 */
export function endAnchorOf(stateFile: StateFile): number | undefined {
  const actions = Object.values(stateFile.actionsState ?? {});
  const isFinal =
    stateFile.isFinal ?? !actions.some((a) => a.state?.toUpperCase().endsWith('ING'));
  if (!isFinal) return undefined;
  const runEnd = millis(stateFile.runEndTime);
  if (runEnd !== undefined) return runEnd;

  const known = actions
    .flatMap((action) => PHASE_TIMESTAMPS.map((field) => millis(action[field])))
    .filter((t): t is number => t !== undefined);
  return known.length > 0 ? Math.max(...known) : undefined;
}

/**
 * The index record for one attempt: what GET /workflow returns, and what the Runs table stores.
 * Includes the three fields the local backend derives client-side in getIndex(), so the SPA
 * receives them ready-made.
 */
export function toWorkflowRun(stateFile: StateFile): WorkflowRun {
  const actionsState = stateFile.actionsState ?? {};
  const actionList = Object.values(actionsState);

  const actions: Record<string, WorkflowRunAction> = {};
  const dataObjects = new Set<string>();
  const actionsStatus: Partial<Record<TaskStatus, number>> = {};

  for (const [name, action] of Object.entries(actionsState)) {
    const written = writtenDataObjects(action);
    actions[name] = { state: action.state, dataObjects: written };
    written.forEach((id) => dataObjects.add(id));
    const state = action.state ?? 'UNKNOWN';
    actionsStatus[state] = (actionsStatus[state] ?? 0) + 1;
  }

  const runEndTime = deriveRunEndTime(stateFile);
  const attemptStartMs = millis(stateFile.attemptStartTime);
  const runEndMs = millis(runEndTime);

  return {
    name: stateFile.appConfig.applicationName,
    runId: stateFile.runId,
    attemptId: stateFile.attemptId,
    feedSel: stateFile.appConfig.feedSel,
    status: aggregateRunStatus(actionList),
    runStartTime: stateFile.runStartTime,
    attemptStartTime: stateFile.attemptStartTime,
    runEndTime,
    actions,
    sdlbVersionInfo: stateFile.sdlbVersionInfo,
    appVersionInfo: stateFile.appVersionInfo,
    buildVersion: stateFile.sdlbVersionInfo?.version ?? null,
    appVersion: stateFile.appVersionInfo?.version ?? stateFile.appVersion ?? null,
    duration:
      attemptStartMs !== undefined && runEndMs !== undefined ? runEndMs - attemptStartMs : undefined,
    attemptStartTimeMillis: attemptStartMs,
    actionsStatus,
    dataObjects: [...dataObjects],
  };
}

/** Per-action facts the RunElements index stores, so "recent runs of X" is one partition query. */
export interface RunElementFacts {
  actionId: string;
  state: TaskStatus;
  inputIds: string[];
  outputIds: string[];
  mainInputCount?: number;
  mainOutputCount?: number;
  durationMillis: number;
  msg?: string;
}

export function runElementFacts(stateFile: StateFile): RunElementFacts[] {
  return Object.entries(stateFile.actionsState ?? {}).map(([actionId, action]) => ({
    actionId,
    state: action.state,
    inputIds: action.inputIds ?? [],
    outputIds: writtenDataObjects(action),
    mainInputCount: getMainInputCount(action as any),
    mainOutputCount: getMainOutputCount(action as any),
    durationMillis: durationMillis(action.duration),
    msg: action.msg,
  }));
}
