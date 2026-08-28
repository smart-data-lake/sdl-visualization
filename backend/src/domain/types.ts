/**
 * The wire contract, mirroring src/types.ts of the frontend.
 *
 * The one systematic difference: timestamps are ISO-8601 **strings** here. The
 * frontend's fetchAPI implementations parse them into Date on arrival (see
 * processRun/processWorkflows/processWorkflowHistory in src/api/fetchAPI_rest.ts),
 * so the server must never emit anything else.
 *
 * This file is a hand-maintained copy. The response conformance suite is what
 * keeps it honest - see test/conformance.
 */

export type TaskStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'PREPARED'
  | 'INITIALIZING'
  | 'INITIALIZED'
  | 'RUNNING'
  | 'FAILED'
  | 'SUCCEEDED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'UNKNOWN';

/** The metrics SDLB recorded for one result of an action. Open ended; see domain/metrics.ts. */
export interface ResultMetrics {
  stage?: string;
  count?: number;
  num_tasks?: number;
  no_data?: boolean;
  records_written?: number;
  files_written?: number;
  num_files?: number;
  rows_inserted?: number;
  num_output_bytes?: number;
  stage_duration?: string;
  bytes_written?: number;
  [metricName: string]: number | string | boolean | undefined;
}

/** What an action wrote to one of its output data objects. */
export interface Result {
  type: string;
  dataObjectId: string;
  partitionValues: unknown[];
  isSkipped?: boolean;
  isDAGStart?: boolean;
  isDummy?: boolean;
  metrics?: ResultMetrics;
}

export interface Action {
  executionId: { type: string; runId: number; attemptId: number };
  state: TaskStatus;
  duration: string;
  msg?: string;
  results: Result[];
  startTstmp?: string;
  endTstmp?: string;
  startTstmpPrepare?: string;
  endTstmpPrepare?: string;
  startTstmpInit?: string;
  endTstmpInit?: string;
  inputIds?: string[];
  outputIds?: string[];
}

export type ActionsState = Record<string, Action>;

export interface VersionInfo {
  version?: string;
}

/** A state file as delivered by GET /state, normalised at ingest by domain/stateFile.ts. */
export interface StateFile {
  appConfig: {
    feedSel: string;
    applicationName: string;
    configuration: string | string[];
    master?: string;
    deployMode?: string;
    parallelism: number;
    statePath: string;
    streaming: boolean;
  };
  runId: number;
  attemptId: number;
  runStartTime: string;
  attemptStartTime: string;
  runEndTime?: string;
  actionsState: ActionsState;
  isFinal?: boolean;
  runStateFormatVersion?: number;
  sdlbVersionInfo?: VersionInfo;
  appVersionInfo?: VersionInfo;
  buildVersionInfo?: VersionInfo;
  appVersion?: string;
}

/** Summary of a workflow (an SDLB application), as delivered by GET /workflows. */
export interface Workflow {
  name: string;
  numRuns: number;
  numAttempts: number;
  lastStatus?: TaskStatus;
  lastAttemptStartTime?: string;
  lastDuration?: number;
  lastNumActions?: number;
}

/** Summary of one action of a WorkflowRun. */
export interface WorkflowRunAction {
  state: TaskStatus;
  /** ids of the data objects written by this action */
  dataObjects: string[];
}

/**
 * One attempt of a workflow run, as delivered by GET /workflow.
 * A summary of the corresponding state file, enriched with attributes the UI
 * would otherwise have to derive itself.
 */
export interface WorkflowRun {
  name: string;
  runId: number;
  attemptId: number;
  feedSel?: string;
  status?: TaskStatus;
  runStartTime?: string;
  attemptStartTime?: string;
  runEndTime?: string;
  actions?: Record<string, WorkflowRunAction>;
  sdlbVersionInfo?: VersionInfo;
  appVersionInfo?: VersionInfo;
  buildVersion?: string | null;
  appVersion?: string | null;
  /** milliseconds between attemptStartTime and runEndTime */
  duration?: number;
  attemptStartTimeMillis?: number;
  actionsStatus?: Partial<Record<TaskStatus, number>>;
  /** ids of all data objects written by this attempt */
  dataObjects?: string[];
}

export interface SchemaColumn {
  name: string;
  dataType: string | SchemaArrayType | SchemaStructType;
  nullable?: boolean;
}
export interface SchemaArrayType {
  dataType: 'array';
  elementType: string | SchemaArrayType | SchemaStructType;
}
export interface SchemaStructType {
  dataType: 'struct';
  fields: SchemaColumn[];
}
export interface SchemaData {
  info?: string;
  schema?: SchemaColumn[];
  subFeedType?: string;
}

export interface Stats {
  numFiles?: number;
  numRows?: number;
  numPartitions?: number;
  tableSizeInBytes?: string;
  columns?: Record<string, unknown>;
  sizeInBytes?: string;
  createdAt?: string;
  lastModifiedAt?: string;
}

/** One entry of GET /descriptions/list. Field names are what SDLB's client expects. */
export interface DescriptionListEntry {
  name: string;
  type: string;
  size: number;
  last_modified: string;
}

/** The parsed SDLB configuration, as delivered by GET /config. */
export interface ConfigJson {
  dataObjects?: Record<string, any>;
  actions?: Record<string, any>;
  connections?: Record<string, any>;
  global?: Record<string, any>;
  [key: string]: any;
}

export type ElementType = 'dataObjects' | 'actions' | 'connections';
export const ELEMENT_TYPES: ElementType[] = ['dataObjects', 'actions', 'connections'];
