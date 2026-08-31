import type { RunRepository } from '../../repositories.js';
import type {
  ElementRef,
  RunElementRecord,
  RunRecord,
  Scope,
  WorkflowRunAction,
  WorkflowSummary,
} from '../../types.js';
import type { TaskStatus } from '../../../domain/types.js';
import { TABLES, type TableStore } from './tables.js';
import { keys, runElementKey, runKey } from './keys.js';
import { MAX_PROPERTY_CHARS } from '../../limits.js';

/**
 * Runs, attempts and their elements.
 *
 * Three parts of this are shaped by Table Storage rather than by the problem, and all
 * three are contained here now:
 *
 *  - Newest-first lives in the row key, via inv() - there is no $orderby.
 *  - RunElements carries every attempt once per action *and* once per data object it
 *    touched, because that is what turns "the last five runs of this element" into a
 *    single partition query rather than a scan.
 *  - `actions` is dropped from the index when it will not fit in a property. The three
 *    derived fields cover everything the UI reads it for, and the full state file is in
 *    the blob either way.
 */

interface RunEntity {
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
  actionsJson?: string;
  buildVersion?: string;
  appVersion?: string;
  blobPath: string;
}

interface RunElementEntity {
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

/**
 * Mapped field by field rather than by spreading the entity: @azure/data-tables attaches
 * etag and timestamp to every row it returns, and a spread carries them straight out
 * through the store and into the /workflows response.
 */
interface WorkflowEntity {
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

function parse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function toRunEntity(scope: Scope, run: RunRecord): RunEntity {
  const actionsJson = JSON.stringify(run.actions ?? {});
  return {
    partitionKey: keys.runs(scope, run.name),
    rowKey: runKey(run.runId, run.attemptId),
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
    // The property cap counts UTF-16 code units - see limits.ts. Over it, the index
    // simply does not carry the map.
    actionsJson: actionsJson.length <= MAX_PROPERTY_CHARS ? actionsJson : undefined,
    buildVersion: run.buildVersion,
    appVersion: run.appVersion,
    blobPath: run.blobPath,
  };
}

function toRunRecord(entity: RunEntity): RunRecord {
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
    buildVersion: entity.buildVersion,
    appVersion: entity.appVersion,
    duration: entity.duration,
    attemptStartTimeMillis: entity.attemptStartTimeMillis,
    actionsStatus: parse(entity.actionsStatusJson, {}),
    dataObjects: parse<string[]>(entity.dataObjectsJson, []),
    blobPath: entity.blobPath,
  };
}

const toWorkflowSummary = (entity: WorkflowEntity): WorkflowSummary => ({
  name: entity.rowKey,
  numRuns: entity.numRuns,
  numAttempts: entity.numAttempts,
  lastStatus: entity.lastStatus,
  lastAttemptStartTime: entity.lastAttemptStartTime,
  lastDuration: entity.lastDuration,
  lastNumActions: entity.lastNumActions,
  lastRunId: entity.lastRunId,
  lastAttemptId: entity.lastAttemptId,
});

const toRunElementRecord = (entity: RunElementEntity): RunElementRecord => ({
  workflow: entity.workflow,
  runId: entity.runId,
  attemptId: entity.attemptId,
  actionId: entity.actionId,
  state: entity.state,
  attemptStartTime: entity.attemptStartTime,
  durationMillis: entity.durationMillis,
  mainInputCount: entity.mainInputCount,
  mainOutputCount: entity.mainOutputCount,
  inputIds: parse<string[]>(entity.inputIdsJson, []),
  outputIds: parse<string[]>(entity.outputIdsJson, []),
  msg: entity.msg,
});

const partitionFor = (scope: Scope, ref: ElementRef): string =>
  ref.kind === 'action' ? keys.runsByAction(scope, ref.id) : keys.runsByDataObject(scope, ref.id);

/**
 * How much to over-read when collapsing element rows to attempts.
 *
 * An attempt appears once per action in a data object's partition, so `limit` rows are
 * not `limit` attempts. Eight is a guess at the worst case, which means a data object
 * touched by more than eight actions per attempt yields fewer attempts than asked for.
 * listRunsTouching documents that as permitted; a store that can express DISTINCT does
 * not need any of this.
 */
const ELEMENT_ROWS_PER_ATTEMPT = 8;

export function runRepository(tables: TableStore): RunRepository {
  return {
    async putRun(scope: Scope, run: RunRecord): Promise<void> {
      await tables.upsert(TABLES.runs, toRunEntity(scope, run));
    },

    async getRun(
      scope: Scope,
      workflow: string,
      runId: number,
      attemptId: number,
    ): Promise<RunRecord | undefined> {
      const entity = await tables.getEntity<RunEntity>(
        TABLES.runs,
        keys.runs(scope, workflow),
        runKey(runId, attemptId),
      );
      return entity && toRunRecord(entity);
    },

    async listRuns(scope: Scope, workflow: string, limit: number): Promise<RunRecord[]> {
      const entities = await tables.listPartition<RunEntity>(TABLES.runs, keys.runs(scope, workflow), {
        limit,
      });
      return entities.map(toRunRecord);
    },

    async countRunsAndAttempts(
      scope: Scope,
      workflow: string,
    ): Promise<{ numRuns: number; numAttempts: number }> {
      // Only the row key: a partition can hold 200 attempts carrying 32 kB of action
      // state each, and fetching all of that to count it would be about 6 MB a time.
      const rows = await tables.listPartition<{ rowKey: string }>(
        TABLES.runs,
        keys.runs(scope, workflow),
        { select: ['RowKey'] },
      );
      const runIds = new Set(rows.map((row) => row.rowKey.split('|')[0]));
      return { numRuns: runIds.size, numAttempts: rows.length };
    },

    async putWorkflowSummary(scope: Scope, summary: WorkflowSummary): Promise<void> {
      const { name, ...rest } = summary;
      await tables.upsert(TABLES.workflows, {
        partitionKey: keys.workflows(scope),
        rowKey: name,
        ...rest,
      });
    },

    async getWorkflowSummary(
      scope: Scope,
      workflow: string,
    ): Promise<WorkflowSummary | undefined> {
      const entity = await tables.getEntity<WorkflowEntity>(
        TABLES.workflows,
        keys.workflows(scope),
        workflow,
      );
      return entity && toWorkflowSummary(entity);
    },

    async listWorkflows(scope: Scope): Promise<WorkflowSummary[]> {
      const entities = await tables.listPartition<WorkflowEntity>(
        TABLES.workflows,
        keys.workflows(scope),
      );
      return entities.map(toWorkflowSummary).sort((a, b) => a.name.localeCompare(b.name));
    },

    async putRunElements(scope: Scope, elements: RunElementRecord[]): Promise<void> {
      const entities: RunElementEntity[] = [];
      for (const element of elements) {
        const base = {
          rowKey: runElementKey(element.runId, element.attemptId, element.actionId),
          workflow: element.workflow,
          runId: element.runId,
          attemptId: element.attemptId,
          actionId: element.actionId,
          state: element.state,
          attemptStartTime: element.attemptStartTime,
          durationMillis: element.durationMillis,
          mainInputCount: element.mainInputCount,
          mainOutputCount: element.mainOutputCount,
          inputIdsJson: JSON.stringify(element.inputIds),
          outputIdsJson: JSON.stringify(element.outputIds),
          msg: element.msg,
        };
        entities.push({ ...base, partitionKey: keys.runsByAction(scope, element.actionId) });
        for (const dataObjectId of new Set([...element.inputIds, ...element.outputIds])) {
          entities.push({ ...base, partitionKey: keys.runsByDataObject(scope, dataObjectId) });
        }
      }
      await tables.upsertBatch(TABLES.runElements, entities);
    },

    async listRunsTouching(scope: Scope, ref: ElementRef, limit: number): Promise<RunRecord[]> {
      const entities = await tables.listPartition<RunElementEntity>(
        TABLES.runElements,
        partitionFor(scope, ref),
        { limit: limit * ELEMENT_ROWS_PER_ATTEMPT },
      );

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
        attempts.map((attempt) =>
          tables.getEntity<RunEntity>(
            TABLES.runs,
            keys.runs(scope, attempt.workflow),
            runKey(attempt.runId, attempt.attemptId),
          ),
        ),
      );
      return runs.filter((run): run is RunEntity => run !== undefined).map(toRunRecord);
    },

    async listRunElements(
      scope: Scope,
      ref: ElementRef,
      limit: number,
    ): Promise<RunElementRecord[]> {
      const entities = await tables.listPartition<RunElementEntity>(
        TABLES.runElements,
        partitionFor(scope, ref),
        { limit },
      );
      return entities.map(toRunElementRecord);
    },
  };
}
