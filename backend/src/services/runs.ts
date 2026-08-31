import { TABLES, getEntity, listPartition, upsert, upsertBatch } from '../store/tables.js';
import { assertKeyPart, keys, runElementKey, runKey, type Scope } from '../store/keys.js';
import { blobPaths, readJson, writeJson } from '../store/blobs.js';
import type { StateFile, TaskStatus, Workflow, WorkflowRun, WorkflowRunAction } from '../domain/types.js';
import { aggregateRunStatus, normalizeStateFile, runElementFacts, toWorkflowRun } from '../domain/stateFile.js';
import { registerScope } from './scope.js';
import { MAX_PROPERTY_CHARS, truncate } from '../store/limits.js';
import { badRequest, notFound } from '../errors.js';

/**
 * Runs: storing what SDLB pushes, and answering the four questions the SPA and the
 * MCP tools ask of it - which workflows exist, which attempts a workflow had, one
 * attempt in full, and which attempts touched a given action or data object.
 *
 * The state file itself lives in Blob; the tables hold only the index. RunElements
 * carries every attempt twice, once under its action and once under each data
 * object, which is what turns "the last five runs of this element" from a scan into
 * a single partition query. The frontend leaves those two fetchAPI methods
 * unimplemented for REST backends, so this is also the point where that gap closes.
 */

/** Runs are read newest-first, and nobody needs more than a page of them at once. */
const DEFAULT_RUN_LIMIT = 200;

export interface RunEntity {
  partitionKey: string;
  rowKey: string;
  name: string;
  runId: number;
  attemptId: number;
  feedSel?: string;
  status?: TaskStatus;
  runStartTime?: string;
  attemptStartTime?: string;
  runEndTime?: string;
  duration?: number;
  attemptStartTimeMillis?: number;
  actionsStatusJson?: string;
  dataObjectsJson?: string;
  /** The full actions map, when it fits inside a table property. */
  actionsJson?: string;
  buildVersion?: string;
  appVersion?: string;
  blobPath: string;
}

export interface RunElementEntity {
  partitionKey: string;
  rowKey: string;
  workflow: string;
  runId: number;
  attemptId: number;
  actionId: string;
  state: TaskStatus;
  attemptStartTime?: string;
  durationMillis?: number;
  mainInputCount?: number;
  mainOutputCount?: number;
  inputIdsJson?: string;
  outputIdsJson?: string;
  msg?: string;
}

export interface WorkflowEntity {
  partitionKey: string;
  rowKey: string;
  numRuns: number;
  numAttempts: number;
  lastStatus?: TaskStatus;
  lastAttemptStartTime?: string;
  lastDuration?: number;
  lastNumActions?: number;
  lastRunId?: number;
  lastAttemptId?: number;
}

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
  const partition = keys.runs(scope, run.name);
  const rowKey = runKey(run.runId, run.attemptId);

  const previous = await getEntity<RunEntity>(TABLES.runs, partition, rowKey);
  const isNewAttempt = previous === undefined;

  const actionsJson = JSON.stringify(run.actions ?? {});
  const runEntity: RunEntity = {
    partitionKey: partition,
    rowKey,
    name: run.name,
    runId: run.runId,
    attemptId: run.attemptId,
    feedSel: run.feedSel,
    status: run.status,
    runStartTime: run.runStartTime,
    attemptStartTime: run.attemptStartTime,
    runEndTime: run.runEndTime,
    duration: run.duration,
    attemptStartTimeMillis: run.attemptStartTimeMillis,
    actionsStatusJson: JSON.stringify(run.actionsStatus ?? {}),
    dataObjectsJson: JSON.stringify(run.dataObjects ?? []),
    // A very large run would exceed the property limit, which is 64 KiB but counts
    // UTF-16 code units - so the bound is 32 768 characters, not 60 000. Measured: 32 769
    // is refused with PropertyValueTooLarge, which fails the SDLB job. The three derived
    // fields above cover everything the UI reads this for, so dropping it is safe.
    actionsJson: actionsJson.length <= MAX_PROPERTY_CHARS ? actionsJson : undefined,
    buildVersion: run.buildVersion ?? undefined,
    appVersion: run.appVersion ?? undefined,
    blobPath: blobPaths.state(scope, run.name, run.runId, run.attemptId),
  };
  await upsert(TABLES.runs, runEntity);

  await indexRunElements(scope, stateFile, run);
  await updateWorkflowSummary(scope, run, isNewAttempt);
}

/**
 * Count the attempts and the distinct runs of a workflow by reading its partition.
 *
 * Deliberately a recount rather than a pair of counters. Counters drift the moment
 * anything fails half way through an upload - which is exactly when nobody is
 * watching - and there is no way to notice or repair the drift afterwards. Reading
 * the partition is self-healing: whatever went wrong, the next upload puts the
 * numbers right. Only the RowKey is fetched, and only when an attempt is new, so a
 * long run of PATCHes never pays for it.
 */
async function countAttempts(
  scope: Scope,
  workflow: string,
): Promise<{ numRuns: number; numAttempts: number }> {
  const rows = await listPartition<{ rowKey: string }>(TABLES.runs, keys.runs(scope, workflow), {
    select: ['RowKey'],
  });
  const runIds = new Set(rows.map((row) => row.rowKey.split('|')[0]));
  return { numRuns: runIds.size, numAttempts: rows.length };
}

async function indexRunElements(scope: Scope, stateFile: StateFile, run: WorkflowRun): Promise<void> {
  const entities: RunElementEntity[] = [];

  for (const facts of runElementFacts(stateFile)) {
    const base = {
      rowKey: runElementKey(run.runId, run.attemptId, facts.actionId),
      workflow: run.name,
      runId: run.runId,
      attemptId: run.attemptId,
      actionId: facts.actionId,
      state: facts.state,
      attemptStartTime: run.attemptStartTime,
      durationMillis: facts.durationMillis,
      mainInputCount: facts.mainInputCount,
      mainOutputCount: facts.mainOutputCount,
      inputIdsJson: JSON.stringify(facts.inputIds),
      outputIdsJson: JSON.stringify(facts.outputIds),
      msg: truncate(facts.msg, 8_000),
    };
    entities.push({ ...base, partitionKey: keys.runsByAction(scope, facts.actionId) });
    for (const dataObjectId of new Set([...facts.inputIds, ...facts.outputIds])) {
      entities.push({ ...base, partitionKey: keys.runsByDataObject(scope, dataObjectId) });
    }
  }

  await upsertBatch(TABLES.runElements, entities);
}

async function updateWorkflowSummary(
  scope: Scope,
  run: WorkflowRun,
  recount: boolean,
): Promise<void> {
  const partition = keys.workflows(scope);
  const existing = await getEntity<WorkflowEntity>(TABLES.workflows, partition, run.name);
  const counts =
    recount || !existing
      ? await countAttempts(scope, run.name)
      : { numRuns: existing.numRuns, numAttempts: existing.numAttempts };

  // Only overwrite the "last..." fields when this really is the newest attempt, so
  // a late upload of an older attempt does not rewrite the workflow's headline.
  const isNewest =
    !existing ||
    existing.lastRunId === undefined ||
    run.runId > existing.lastRunId ||
    (run.runId === existing.lastRunId && run.attemptId >= (existing.lastAttemptId ?? 0));

  const entity: WorkflowEntity = {
    partitionKey: partition,
    rowKey: run.name,
    numRuns: counts.numRuns,
    numAttempts: counts.numAttempts,
    lastStatus: isNewest ? run.status : existing?.lastStatus,
    lastAttemptStartTime: isNewest ? run.attemptStartTime : existing?.lastAttemptStartTime,
    lastDuration: isNewest ? run.duration : existing?.lastDuration,
    lastNumActions: isNewest ? Object.keys(run.actions ?? {}).length : existing?.lastNumActions,
    lastRunId: isNewest ? run.runId : existing?.lastRunId,
    lastAttemptId: isNewest ? run.attemptId : existing?.lastAttemptId,
  };
  await upsert(TABLES.workflows, entity);
}

/* ------------------------------------------------------------------ reading */

export async function getWorkflows(scope: Scope): Promise<Workflow[]> {
  const entities = await listPartition<WorkflowEntity>(TABLES.workflows, keys.workflows(scope));
  return entities
    .map((e) => ({
      name: e.rowKey,
      numRuns: e.numRuns,
      numAttempts: e.numAttempts,
      lastStatus: e.lastStatus,
      lastAttemptStartTime: e.lastAttemptStartTime,
      lastDuration: e.lastDuration,
      lastNumActions: e.lastNumActions,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getWorkflowRuns(
  scope: Scope,
  application: string,
  limit = DEFAULT_RUN_LIMIT,
): Promise<WorkflowRun[]> {
  const entities = await listPartition<RunEntity>(TABLES.runs, keys.runs(scope, application), {
    limit,
  });
  return entities.map(toRun);
}

function toRun(entity: RunEntity): WorkflowRun {
  return {
    name: entity.name,
    runId: entity.runId,
    attemptId: entity.attemptId,
    feedSel: entity.feedSel,
    status: entity.status,
    runStartTime: entity.runStartTime,
    attemptStartTime: entity.attemptStartTime,
    runEndTime: entity.runEndTime,
    actions: parse<Record<string, WorkflowRunAction>>(entity.actionsJson, {}),
    buildVersion: entity.buildVersion ?? null,
    appVersion: entity.appVersion ?? null,
    duration: entity.duration,
    attemptStartTimeMillis: entity.attemptStartTimeMillis,
    actionsStatus: parse(entity.actionsStatusJson, {}),
    dataObjects: parse<string[]>(entity.dataObjectsJson, []),
  };
}

function parse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
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

export type RunElementKind = 'action' | 'dataObject';

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
  const partition =
    kind === 'action' ? keys.runsByAction(scope, name) : keys.runsByDataObject(scope, name);
  // One row per action, so an attempt appears several times in a data object's
  // partition - once for each action that read or wrote it. Read more than asked
  // for, then collapse to attempts.
  const entities = await listPartition<RunElementEntity>(TABLES.runElements, partition, {
    limit: limit * 8,
  });

  const attempts: { workflow: string; runId: number; attemptId: number }[] = [];
  const seen = new Set<string>();
  for (const entity of entities) {
    const key = `${entity.workflow}|${entity.runId}|${entity.attemptId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    attempts.push(entity);
    if (attempts.length >= limit) break;
  }

  const runs = await Promise.all(
    attempts.map((a) =>
      getEntity<RunEntity>(TABLES.runs, keys.runs(scope, a.workflow), runKey(a.runId, a.attemptId)),
    ),
  );
  return runs.filter((r): r is RunEntity => r !== undefined).map(toRun);
}

/** The per-action rows behind one element's history, which carry the metrics and messages. */
export async function getElementHistory(
  scope: Scope,
  kind: RunElementKind,
  name: string,
  limit = 20,
): Promise<RunElementEntity[]> {
  const partition =
    kind === 'action' ? keys.runsByAction(scope, name) : keys.runsByDataObject(scope, name);
  return listPartition<RunElementEntity>(TABLES.runElements, partition, { limit });
}

/** The status one attempt ended in, without downloading its state file. */
export async function getRunStatus(
  scope: Scope,
  application: string,
  runId: number,
  attemptId: number,
): Promise<TaskStatus | undefined> {
  const entity = await getEntity<RunEntity>(
    TABLES.runs,
    keys.runs(scope, application),
    runKey(runId, attemptId),
  );
  return entity?.status;
}

export { aggregateRunStatus };
