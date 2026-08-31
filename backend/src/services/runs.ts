import { repositories } from '../store/repositories.js';
import type {
  ElementRef,
  RunElementRecord,
  RunRecord,
  Scope,
  WorkflowSummary,
} from '../store/types.js';
import { assertKeyPart } from '../store/limits.js';
import { blobPaths, readJson, writeJson } from '../store/blobs.js';
import type { StateFile, TaskStatus, Workflow, WorkflowRun } from '../domain/types.js';
import { aggregateRunStatus, normalizeStateFile, runElementFacts, toWorkflowRun } from '../domain/stateFile.js';
import { registerScope } from './scope.js';
import { truncate } from '../store/limits.js';
import { badRequest, notFound } from '../errors.js';

/**
 * Runs: storing what SDLB pushes, and answering the four questions the SPA and the
 * MCP tools ask of it - which workflows exist, which attempts a workflow had, one
 * attempt in full, and which attempts touched a given action or data object.
 *
 * The state file itself lives in Blob; the store holds only the index. How that index
 * is laid out is the driver's business - see drivers/azureTables/runs.ts for the three
 * places Table Storage shapes it. The frontend leaves the two by-element fetchAPI
 * methods unimplemented for REST backends, so this is also where that gap closes.
 */

/** Runs are read newest-first, and nobody needs more than a page of them at once. */
const DEFAULT_RUN_LIMIT = 200;

/* ------------------------------------------------------------------ writing */

export async function putState(scope: Scope, raw: unknown): Promise<{ name: string; runId: number; attemptId: number }> {
  const stateFile = normalizeStateFile(raw);
  const name = stateFile.appConfig?.applicationName;
  // A malformed upload is the caller's mistake, not a missing resource. The status
  // matters: SDLB fails the job on any non-2xx, so the log has to say why.
  if (!name) throw badRequest('the uploaded state has no appConfig.applicationName');

  // Both checks before the write, in this order. blobPaths refuses anything that could
  // climb out of the prefix, as a 400 - it is the caller's value. assertKeyPart then
  // refuses the key separator, which is legal in a path but would collide in a table
  // key; indexState would otherwise reach it only once the blob had been stored under a
  // name it cannot index.
  const path = blobPaths.state(scope, name, stateFile.runId, stateFile.attemptId);
  assertKeyPart(name, 'workflow');

  await writeJson(path, stateFile);
  await indexState(scope, stateFile);
  await registerScope(scope);
  return { name, runId: stateFile.runId, attemptId: stateFile.attemptId };
}

/**
 * Merge one action's state into an attempt that is already stored.
 * SDLB sends this while a run is in flight, once per action state change, so it has
 * to be cheap and must never lose the rest of the attempt.
 */
export async function patchState(
  scope: Scope,
  name: string,
  runId: number,
  attemptId: number,
  actionId: string,
  actionState: unknown,
): Promise<void> {
  const path = blobPaths.state(scope, name, runId, attemptId);
  const stateFile = await readJson<StateFile>(path);
  if (!stateFile) throw notFound(`attempt ${runId}.${attemptId} of ${name}`);

  stateFile.actionsState = stateFile.actionsState ?? {};
  stateFile.actionsState[actionId] = {
    ...stateFile.actionsState[actionId],
    ...(actionState as object),
  } as StateFile['actionsState'][string];

  const normalized = normalizeStateFile(stateFile);
  await writeJson(path, normalized);
  await indexState(scope, normalized);
}

async function indexState(scope: Scope, stateFile: StateFile): Promise<void> {
  const run = toWorkflowRun(stateFile);
  const runs = (await repositories()).runs;

  const previous = await runs.getRun(scope, run.name, run.runId, run.attemptId);
  const isNewAttempt = previous === undefined;

  const record: RunRecord = {
    ...run,
    buildVersion: run.buildVersion ?? undefined,
    appVersion: run.appVersion ?? undefined,
    blobPath: blobPaths.state(scope, run.name, run.runId, run.attemptId),
  };
  await runs.putRun(scope, record);

  await indexRunElements(scope, stateFile, run);
  await updateWorkflowSummary(scope, run, isNewAttempt);
}

async function indexRunElements(scope: Scope, stateFile: StateFile, run: WorkflowRun): Promise<void> {
  const elements: RunElementRecord[] = runElementFacts(stateFile).map((facts) => ({
    workflow: run.name,
    runId: run.runId,
    attemptId: run.attemptId,
    actionId: facts.actionId,
    state: facts.state,
    attemptStartTime: run.attemptStartTime,
    durationMillis: facts.durationMillis,
    mainInputCount: facts.mainInputCount,
    mainOutputCount: facts.mainOutputCount,
    inputIds: facts.inputIds,
    outputIds: facts.outputIds,
    msg: truncate(facts.msg, 8_000),
  }));
  await (await repositories()).runs.putRunElements(scope, elements);
}

async function updateWorkflowSummary(
  scope: Scope,
  run: WorkflowRun,
  recount: boolean,
): Promise<void> {
  const runs = (await repositories()).runs;
  const existing = await runs.getWorkflowSummary(scope, run.name);
  const counts =
    recount || !existing
      ? await runs.countRunsAndAttempts(scope, run.name)
      : { numRuns: existing.numRuns, numAttempts: existing.numAttempts };

  // Only overwrite the "last..." fields when this really is the newest attempt, so
  // a late upload of an older attempt does not rewrite the workflow's headline.
  const isNewest =
    !existing ||
    existing.lastRunId === undefined ||
    run.runId > existing.lastRunId ||
    (run.runId === existing.lastRunId && run.attemptId >= (existing.lastAttemptId ?? 0));

  const summary: WorkflowSummary = {
    name: run.name,
    numRuns: counts.numRuns,
    numAttempts: counts.numAttempts,
    lastStatus: isNewest ? run.status : existing?.lastStatus,
    lastAttemptStartTime: isNewest ? run.attemptStartTime : existing?.lastAttemptStartTime,
    lastDuration: isNewest ? run.duration : existing?.lastDuration,
    lastNumActions: isNewest ? Object.keys(run.actions ?? {}).length : existing?.lastNumActions,
    lastRunId: isNewest ? run.runId : existing?.lastRunId,
    lastAttemptId: isNewest ? run.attemptId : existing?.lastAttemptId,
  };
  await runs.putWorkflowSummary(scope, summary);
}

/* ------------------------------------------------------------------ reading */

export async function getWorkflows(scope: Scope): Promise<Workflow[]> {
  const summaries = await (await repositories()).runs.listWorkflows(scope);
  // The wire contract stops at lastNumActions; lastRunId and lastAttemptId exist only
  // so updateWorkflowSummary can tell whether a late upload is the newest attempt.
  return summaries.map(({ lastRunId: _r, lastAttemptId: _a, ...workflow }) => workflow);
}

export async function getWorkflowRuns(
  scope: Scope,
  application: string,
  limit = DEFAULT_RUN_LIMIT,
): Promise<WorkflowRun[]> {
  const records = await (await repositories()).runs.listRuns(scope, application, limit);
  return records.map(toWire);
}

/** The wire shape allows null where the store holds nothing - see types.ts RunRecord. */
function toWire({ blobPath: _blobPath, ...record }: RunRecord): WorkflowRun {
  return {
    ...record,
    buildVersion: record.buildVersion ?? null,
    appVersion: record.appVersion ?? null,
  };
}

export async function getRun(
  scope: Scope,
  application: string,
  runId: number,
  attemptId: number,
): Promise<StateFile> {
  const stateFile = await readJson<StateFile>(blobPaths.state(scope, application, runId, attemptId));
  if (!stateFile) throw notFound(`attempt ${runId}.${attemptId} of ${application}`);
  return stateFile;
}

export type RunElementKind = ElementRef['kind'];

/**
 * The attempts that touched one element, newest first. Backs the config explorer's
 * "Last 5 runs" panel and the MCP tools' history questions.
 */
export async function getRunsByElement(
  scope: Scope,
  kind: RunElementKind,
  name: string,
  limit = 20,
): Promise<WorkflowRun[]> {
  const records = await (
    await repositories()
  ).runs.listRunsTouching(scope, { kind, id: name }, limit);
  return records.map(toWire);
}

/** The per-action rows behind one element's history, which carry the metrics and messages. */
export async function getElementHistory(
  scope: Scope,
  kind: RunElementKind,
  name: string,
  limit = 20,
): Promise<RunElementRecord[]> {
  return (await repositories()).runs.listRunElements(scope, { kind, id: name }, limit);
}

/** The status one attempt ended in, without downloading its state file. */
export async function getRunStatus(
  scope: Scope,
  application: string,
  runId: number,
  attemptId: number,
): Promise<TaskStatus | undefined> {
  const record = await (await repositories()).runs.getRun(scope, application, runId, attemptId);
  return record?.status;
}

export { aggregateRunStatus };
