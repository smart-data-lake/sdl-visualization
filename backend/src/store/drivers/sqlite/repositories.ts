import type {
  ConfigRepository,
  Repositories,
  RunRepository,
  SchemaStatsRepository,
  ScopeRepository,
  TokenRepository,
  WorkspaceRepository,
} from '../../repositories.js';
import type {
  ConfigElementRecord,
  ConfigVersionRecord,
  ElementRef,
  LatestElementRecord,
  RunElementRecord,
  RunRecord,
  Scope,
  StoredToken,
  Subtype,
  TstampEntry,
  WorkflowRunAction,
  WorkflowSummary,
  WorkspaceRule,
} from '../../types.js';
import type { TaskStatus } from '../../../domain/types.js';
import { assertKeyPart, assertNoDuplicates } from '../../limits.js';
import { limitClause, type Db } from './db.js';

/**
 * The repositories on real columns.
 *
 * Every ordering here is `ORDER BY ... DESC` on an integer, so nothing needs the
 * inverted string keys the Azure driver depends on. The two places that driver has to
 * work around a missing feature are one statement each: counting distinct runs is
 * COUNT(DISTINCT), and collapsing element rows to attempts is DISTINCT with a real LIMIT
 * instead of an eightfold over-read.
 *
 * assertKeyPart still guards every value that identifies a row. SQLite would not care,
 * but a record written here has to remain loadable on Azure, and a violation should fail
 * on whichever backend the author happens to be running.
 */

const json = (value: unknown): string => JSON.stringify(value);

function parse<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** SQLite hands back null where the record has undefined. */
const opt = <T>(value: T | null): T | undefined => (value === null ? undefined : value);

const scopeOf = (scope: Scope) => ({
  repo: assertKeyPart(scope.repo, 'repo'),
  env: assertKeyPart(scope.env, 'env'),
});

/* ------------------------------------------------------------------- scopes */

function scopeRepository(db: Db): ScopeRepository {
  return {
    async register(scope: Scope): Promise<void> {
      db.upsert('scopes', ['repo', 'env'], {
        ...scopeOf(scope),
        last_seen_at: new Date().toISOString(),
      });
    },

    async listRepos(): Promise<string[]> {
      return db
        .all<{ repo: string }>('SELECT DISTINCT repo FROM scopes ORDER BY repo')
        .map((row) => row.repo);
    },

    async listEnvs(repo: string): Promise<string[]> {
      return db
        .all<{ env: string }>('SELECT env FROM scopes WHERE repo = ? ORDER BY env', repo)
        .map((row) => row.env);
    },
  };
}

/* --------------------------------------------------------------- workspaces */

interface WorkspaceRow {
  repos: string | null;
  envs: string | null;
  required_group: string | null;
}

function workspaceRepository(db: Db): WorkspaceRepository {
  return {
    async getRule(workspaceHost: string): Promise<WorkspaceRule | undefined> {
      const row = db.get<WorkspaceRow>(
        'SELECT repos, envs, required_group FROM workspaces WHERE host = ?',
        workspaceHost,
      );
      if (!row) return undefined;
      return {
        repos: opt(row.repos),
        envs: opt(row.envs),
        requiredGroup: opt(row.required_group),
      };
    },

    async putRule(workspaceHost: string, rule: WorkspaceRule): Promise<void> {
      db.upsert('workspaces', ['host'], {
        host: workspaceHost,
        repos: rule.repos,
        envs: rule.envs,
        required_group: rule.requiredGroup,
      });
    },
  };
}

/* ------------------------------------------------------------------- tokens */

interface TokenRow {
  id: string;
  email: string | null;
  label: string | null;
  created_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
}

const toToken = (row: TokenRow): StoredToken => ({
  id: row.id,
  email: row.email ?? '',
  label: row.label ?? '',
  createdAt: row.created_at ?? '',
  expiresAt: opt(row.expires_at),
  lastUsedAt: opt(row.last_used_at),
});

const TOKEN_COLUMNS = 'id, email, label, created_at, expires_at, last_used_at';

function tokenRepository(db: Db): TokenRepository {
  return {
    async put(scope: Scope, token: StoredToken): Promise<void> {
      db.upsert('tokens', ['repo', 'env', 'id'], {
        ...scopeOf(scope),
        id: token.id,
        email: token.email,
        label: token.label,
        created_at: token.createdAt,
        expires_at: token.expiresAt,
        last_used_at: token.lastUsedAt,
      });
    },

    async get(scope: Scope, id: string): Promise<StoredToken | undefined> {
      const { repo, env } = scopeOf(scope);
      const row = db.get<TokenRow>(
        `SELECT ${TOKEN_COLUMNS} FROM tokens WHERE repo = ? AND env = ? AND id = ?`,
        repo,
        env,
        id,
      );
      return row && toToken(row);
    },

    async list(scope: Scope): Promise<StoredToken[]> {
      const { repo, env } = scopeOf(scope);
      return db
        .all<TokenRow>(
          `SELECT ${TOKEN_COLUMNS} FROM tokens WHERE repo = ? AND env = ? ORDER BY id`,
          repo,
          env,
        )
        .map(toToken);
    },

    async delete(scope: Scope, id: string): Promise<void> {
      const { repo, env } = scopeOf(scope);
      db.run('DELETE FROM tokens WHERE repo = ? AND env = ? AND id = ?', repo, env, id);
    },

    // Only this column: everything else keeps its stored value, via the COALESCE in
    // Db.upsert. No read, so a concurrent writer of another column cannot be lost.
    async touch(scope: Scope, id: string, at: string): Promise<void> {
      db.upsert('tokens', ['repo', 'env', 'id'], {
        ...scopeOf(scope),
        id,
        last_used_at: at,
      });
    },
  };
}

/* -------------------------------------------------------------- schema/stats */

function schemaStatsRepository(db: Db): SchemaStatsRepository {
  return {
    async put(
      scope: Scope,
      subtype: Subtype,
      dataObjectId: string,
      entry: TstampEntry,
    ): Promise<void> {
      db.upsert('tstamps', ['repo', 'env', 'subtype', 'data_object_id', 'tstamp'], {
        ...scopeOf(scope),
        subtype,
        data_object_id: assertKeyPart(dataObjectId, 'dataObjectId'),
        tstamp: entry.tstamp,
        blob_path: entry.blobPath,
        size_bytes: entry.sizeBytes,
      });
    },

    async listTstamps(scope: Scope, subtype: Subtype, dataObjectId: string): Promise<number[]> {
      const { repo, env } = scopeOf(scope);
      return db
        .all<{ tstamp: number }>(
          `SELECT tstamp FROM tstamps
             WHERE repo = ? AND env = ? AND subtype = ? AND data_object_id = ?
             ORDER BY tstamp DESC`,
          repo,
          env,
          subtype,
          dataObjectId,
        )
        .map((row) => row.tstamp);
    },
  };
}

/* ------------------------------------------------------------------ configs */

const ELEMENT_COLUMNS: Record<keyof Omit<ConfigElementRecord, 'id' | 'elementType'>, string> = {
  type: 'type',
  name: 'name',
  layer: 'layer',
  subjectArea: 'subject_area',
  feed: 'feed',
  tags: 'tags',
  connectionId: 'connection_id',
  inputIds: 'input_ids',
  outputIds: 'output_ids',
  path: 'path',
  tableFullName: 'table_full_name',
  originPath: 'origin_path',
  originLine: 'origin_line',
  descriptionSnippet: 'description_snippet',
  searchText: 'search_text',
};

function configRepository(db: Db): ConfigRepository {
  return {
    async putVersion(scope: Scope, version: ConfigVersionRecord): Promise<void> {
      db.upsert('config_versions', ['repo', 'env', 'version'], {
        ...scopeOf(scope),
        version: assertKeyPart(version.version, 'version'),
        created_at: version.createdAt,
        blob_path: version.blobPath,
        num_data_objects: version.numDataObjects,
        num_actions: version.numActions,
        num_connections: version.numConnections,
      });
    },

    async listVersions(scope: Scope): Promise<string[]> {
      const { repo, env } = scopeOf(scope);
      return db
        .all<{ version: string }>(
          'SELECT version FROM config_versions WHERE repo = ? AND env = ? ORDER BY version',
          repo,
          env,
        )
        .map((row) => row.version);
    },

    async putElements(
      scope: Scope,
      version: string,
      elements: ConfigElementRecord[],
    ): Promise<void> {
      const base = { ...scopeOf(scope), version: assertKeyPart(version, 'version') };
      assertNoDuplicates(
        elements.map((element) => [element.elementType, element.id]),
        'config_elements',
      );
      db.upsertMany(
        'config_elements',
        ['repo', 'env', 'version', 'element_type', 'id'],
        elements.map((element) => {
          const row: Record<string, unknown> = {
            ...base,
            element_type: element.elementType,
            id: assertKeyPart(element.id, 'element id'),
          };
          for (const [field, column] of Object.entries(ELEMENT_COLUMNS)) {
            row[column] = element[field as keyof ConfigElementRecord];
          }
          return row;
        }),
      );
    },

    async putLatestElements(scope: Scope, elements: LatestElementRecord[]): Promise<void> {
      const base = scopeOf(scope);
      assertNoDuplicates(
        elements.map((element) => [element.elementType, element.id]),
        'elements',
      );
      db.upsertMany(
        'elements',
        ['repo', 'env', 'element_type', 'id'],
        elements.map((element) => ({
          ...base,
          element_type: element.elementType,
          id: assertKeyPart(element.id, 'element id'),
          last_version: element.lastVersion,
          last_seen_at: element.lastSeenAt,
          type: element.type,
          layer: element.layer,
        })),
      );
    },
  };
}

/* --------------------------------------------------------------------- runs */

interface RunRow {
  workflow: string;
  run_id: number;
  attempt_id: number;
  feed_sel: string | null;
  status: TaskStatus | null;
  run_start_time: string | null;
  attempt_start_time: string | null;
  run_end_time: string | null;
  duration: number | null;
  attempt_start_time_millis: number | null;
  actions_status_json: string | null;
  data_objects_json: string | null;
  actions_json: string | null;
  build_version: string | null;
  app_version: string | null;
  blob_path: string | null;
}

const RUN_COLUMNS =
  'workflow, run_id, attempt_id, feed_sel, status, run_start_time, attempt_start_time, ' +
  'run_end_time, duration, attempt_start_time_millis, actions_status_json, ' +
  'data_objects_json, actions_json, build_version, app_version, blob_path';

const toRunRecord = (row: RunRow): RunRecord => ({
  name: row.workflow,
  runId: row.run_id,
  attemptId: row.attempt_id,
  feedSel: opt(row.feed_sel),
  status: opt(row.status),
  runStartTime: opt(row.run_start_time),
  attemptStartTime: opt(row.attempt_start_time),
  runEndTime: opt(row.run_end_time),
  actions: parse<Record<string, WorkflowRunAction>>(row.actions_json, {}),
  buildVersion: opt(row.build_version),
  appVersion: opt(row.app_version),
  duration: opt(row.duration),
  attemptStartTimeMillis: opt(row.attempt_start_time_millis),
  actionsStatus: parse(row.actions_status_json, {}),
  dataObjects: parse<string[]>(row.data_objects_json, []),
  blobPath: row.blob_path ?? '',
});

interface RunElementRow {
  workflow: string;
  run_id: number;
  attempt_id: number;
  action_id: string;
  state: TaskStatus | null;
  attempt_start_time: string | null;
  duration_millis: number | null;
  main_input_count: number | null;
  main_output_count: number | null;
  input_ids_json: string | null;
  output_ids_json: string | null;
  msg: string | null;
}

const RUN_ELEMENT_COLUMNS =
  'workflow, run_id, attempt_id, action_id, state, attempt_start_time, duration_millis, ' +
  'main_input_count, main_output_count, input_ids_json, output_ids_json, msg';

const toRunElementRecord = (row: RunElementRow): RunElementRecord => ({
  workflow: row.workflow,
  runId: row.run_id,
  attemptId: row.attempt_id,
  actionId: row.action_id,
  state: row.state ?? 'UNKNOWN',
  attemptStartTime: opt(row.attempt_start_time),
  durationMillis: opt(row.duration_millis),
  mainInputCount: opt(row.main_input_count),
  mainOutputCount: opt(row.main_output_count),
  inputIds: parse<string[]>(row.input_ids_json, []),
  outputIds: parse<string[]>(row.output_ids_json, []),
  msg: opt(row.msg),
});

interface WorkflowRow {
  workflow: string;
  num_runs: number | null;
  num_attempts: number | null;
  last_status: TaskStatus | null;
  last_attempt_start_time: string | null;
  last_duration: number | null;
  last_num_actions: number | null;
  last_run_id: number | null;
  last_attempt_id: number | null;
}

const WORKFLOW_COLUMNS =
  'workflow, num_runs, num_attempts, last_status, last_attempt_start_time, last_duration, ' +
  'last_num_actions, last_run_id, last_attempt_id';

const toWorkflowSummary = (row: WorkflowRow): WorkflowSummary => ({
  name: row.workflow,
  numRuns: row.num_runs ?? 0,
  numAttempts: row.num_attempts ?? 0,
  lastStatus: opt(row.last_status),
  lastAttemptStartTime: opt(row.last_attempt_start_time),
  lastDuration: opt(row.last_duration),
  lastNumActions: opt(row.last_num_actions),
  lastRunId: opt(row.last_run_id),
  lastAttemptId: opt(row.last_attempt_id),
});

function runRepository(db: Db): RunRepository {
  /** The join that replaces the Azure driver's over-read: real DISTINCT, real LIMIT. */
  function attemptsTouching(scope: Scope, ref: ElementRef, limit: number) {
    const { repo, env } = scopeOf(scope);
    if (ref.kind === 'action') {
      return db.all<{ workflow: string; run_id: number; attempt_id: number }>(
        `SELECT DISTINCT workflow, run_id, attempt_id FROM run_elements
           WHERE repo = ? AND env = ? AND action_id = ?
           ORDER BY run_id DESC, attempt_id DESC${limitClause(limit)}`,
        repo,
        env,
        ref.id,
      );
    }
    return db.all<{ workflow: string; run_id: number; attempt_id: number }>(
      `SELECT DISTINCT workflow, run_id, attempt_id FROM run_element_data_objects
         WHERE repo = ? AND env = ? AND data_object_id = ?
         ORDER BY run_id DESC, attempt_id DESC${limitClause(limit)}`,
      repo,
      env,
      ref.id,
    );
  }

  return {
    async putRun(scope: Scope, run: RunRecord): Promise<void> {
      const actionsJson = json(run.actions ?? {});
      db.upsert('runs', ['repo', 'env', 'workflow', 'run_id', 'attempt_id'], {
        ...scopeOf(scope),
        workflow: assertKeyPart(run.name, 'workflow'),
        run_id: run.runId,
        attempt_id: run.attemptId,
        feed_sel: run.feedSel,
        status: run.status,
        run_start_time: run.runStartTime,
        attempt_start_time: run.attemptStartTime,
        run_end_time: run.runEndTime,
        duration: run.duration,
        attempt_start_time_millis: run.attemptStartTimeMillis,
        actions_status_json: json(run.actionsStatus ?? {}),
        data_objects_json: json(run.dataObjects ?? []),
        // No property-size limit here, so the map is always indexed - unlike the Azure
        // driver, which has to drop it past 32 768 characters.
        actions_json: actionsJson,
        build_version: run.buildVersion,
        app_version: run.appVersion,
        blob_path: run.blobPath,
      });
    },

    async getRun(
      scope: Scope,
      workflow: string,
      runId: number,
      attemptId: number,
    ): Promise<RunRecord | undefined> {
      const { repo, env } = scopeOf(scope);
      const row = db.get<RunRow>(
        `SELECT ${RUN_COLUMNS} FROM runs
           WHERE repo = ? AND env = ? AND workflow = ? AND run_id = ? AND attempt_id = ?`,
        repo,
        env,
        workflow,
        runId,
        attemptId,
      );
      return row && toRunRecord(row);
    },

    async listRuns(scope: Scope, workflow: string, limit: number): Promise<RunRecord[]> {
      const { repo, env } = scopeOf(scope);
      return db
        .all<RunRow>(
          `SELECT ${RUN_COLUMNS} FROM runs
             WHERE repo = ? AND env = ? AND workflow = ?
             ORDER BY run_id DESC, attempt_id DESC${limitClause(limit)}`,
          repo,
          env,
          workflow,
        )
        .map(toRunRecord);
    },

    // One statement, and no rows read: the Azure driver has to scan the partition for
    // row keys and count distinct prefixes in JavaScript.
    async countRunsAndAttempts(
      scope: Scope,
      workflow: string,
    ): Promise<{ numRuns: number; numAttempts: number }> {
      const { repo, env } = scopeOf(scope);
      const row = db.get<{ runs: number; attempts: number }>(
        `SELECT COUNT(DISTINCT run_id) AS runs, COUNT(*) AS attempts FROM runs
           WHERE repo = ? AND env = ? AND workflow = ?`,
        repo,
        env,
        workflow,
      );
      return { numRuns: row?.runs ?? 0, numAttempts: row?.attempts ?? 0 };
    },

    async putWorkflowSummary(scope: Scope, summary: WorkflowSummary): Promise<void> {
      db.upsert('workflows', ['repo', 'env', 'workflow'], {
        ...scopeOf(scope),
        workflow: assertKeyPart(summary.name, 'workflow'),
        num_runs: summary.numRuns,
        num_attempts: summary.numAttempts,
        last_status: summary.lastStatus,
        last_attempt_start_time: summary.lastAttemptStartTime,
        last_duration: summary.lastDuration,
        last_num_actions: summary.lastNumActions,
        last_run_id: summary.lastRunId,
        last_attempt_id: summary.lastAttemptId,
      });
    },

    async getWorkflowSummary(
      scope: Scope,
      workflow: string,
    ): Promise<WorkflowSummary | undefined> {
      const { repo, env } = scopeOf(scope);
      const row = db.get<WorkflowRow>(
        `SELECT ${WORKFLOW_COLUMNS} FROM workflows WHERE repo = ? AND env = ? AND workflow = ?`,
        repo,
        env,
        workflow,
      );
      return row && toWorkflowSummary(row);
    },

    async listWorkflows(scope: Scope): Promise<WorkflowSummary[]> {
      const { repo, env } = scopeOf(scope);
      return db
        .all<WorkflowRow>(
          `SELECT ${WORKFLOW_COLUMNS} FROM workflows WHERE repo = ? AND env = ?`,
          repo,
          env,
        )
        .map(toWorkflowSummary)
        // In JavaScript, not in SQL: the interface promises name order, and SQLite's
        // BINARY collation would put every capital before every lower-case letter.
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async putRunElements(scope: Scope, elements: RunElementRecord[]): Promise<void> {
      if (elements.length === 0) return;
      const base = scopeOf(scope);
      assertNoDuplicates(
        elements.map((element) => [
          element.workflow,
          element.runId,
          element.attemptId,
          element.actionId,
        ]),
        'run_elements',
      );

      db.upsertMany(
        'run_elements',
        ['repo', 'env', 'workflow', 'run_id', 'attempt_id', 'action_id'],
        elements.map((element) => ({
          ...base,
          workflow: assertKeyPart(element.workflow, 'workflow'),
          run_id: element.runId,
          attempt_id: element.attemptId,
          action_id: assertKeyPart(element.actionId, 'actionId'),
          state: element.state,
          attempt_start_time: element.attemptStartTime,
          duration_millis: element.durationMillis,
          main_input_count: element.mainInputCount,
          main_output_count: element.mainOutputCount,
          input_ids_json: json(element.inputIds),
          output_ids_json: json(element.outputIds),
          msg: element.msg,
        })),
      );

      // The link table, which is what the Azure driver achieves by writing the whole
      // element row a second time under each data object.
      const links: Record<string, unknown>[] = [];
      for (const element of elements) {
        for (const dataObjectId of new Set([...element.inputIds, ...element.outputIds])) {
          links.push({
            ...base,
            data_object_id: assertKeyPart(dataObjectId, 'dataObjectId'),
            workflow: element.workflow,
            run_id: element.runId,
            attempt_id: element.attemptId,
            action_id: element.actionId,
          });
        }
      }
      db.upsertMany(
        'run_element_data_objects',
        ['repo', 'env', 'data_object_id', 'run_id', 'attempt_id', 'workflow', 'action_id'],
        links,
      );
    },

    async listRunsTouching(scope: Scope, ref: ElementRef, limit: number): Promise<RunRecord[]> {
      const { repo, env } = scopeOf(scope);
      const attempts = attemptsTouching(scope, ref, limit);
      const runs: RunRecord[] = [];
      for (const attempt of attempts) {
        const row = db.get<RunRow>(
          `SELECT ${RUN_COLUMNS} FROM runs
             WHERE repo = ? AND env = ? AND workflow = ? AND run_id = ? AND attempt_id = ?`,
          repo,
          env,
          attempt.workflow,
          attempt.run_id,
          attempt.attempt_id,
        );
        if (row) runs.push(toRunRecord(row));
      }
      return runs;
    },

    async listRunElements(
      scope: Scope,
      ref: ElementRef,
      limit: number,
    ): Promise<RunElementRecord[]> {
      const { repo, env } = scopeOf(scope);
      if (ref.kind === 'action') {
        return db
          .all<RunElementRow>(
            `SELECT ${RUN_ELEMENT_COLUMNS} FROM run_elements
               WHERE repo = ? AND env = ? AND action_id = ?
               ORDER BY run_id DESC, attempt_id DESC${limitClause(limit)}`,
            repo,
            env,
            ref.id,
          )
          .map(toRunElementRecord);
      }
      // Through the link table, so the element row exists once however many data objects
      // an action touched.
      return db
        .all<RunElementRow>(
          `SELECT ${RUN_ELEMENT_COLUMNS.split(', ')
            .map((c) => `e.${c}`)
            .join(', ')}
             FROM run_element_data_objects d
             JOIN run_elements e
               ON e.repo = d.repo AND e.env = d.env AND e.workflow = d.workflow
              AND e.run_id = d.run_id AND e.attempt_id = d.attempt_id
              AND e.action_id = d.action_id
             WHERE d.repo = ? AND d.env = ? AND d.data_object_id = ?
             ORDER BY e.run_id DESC, e.attempt_id DESC${limitClause(limit)}`,
          repo,
          env,
          ref.id,
        )
        .map(toRunElementRecord);
    },
  };
}

export function buildRepositories(db: Db): Repositories {
  return {
    runs: runRepository(db),
    scopes: scopeRepository(db),
    workspaces: workspaceRepository(db),
    tokens: tokenRepository(db),
    schemaStats: schemaStatsRepository(db),
    configs: configRepository(db),
  };
}
