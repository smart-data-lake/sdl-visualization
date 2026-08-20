import { durationMillis } from "./util/WorkflowsExplorer/date";

export interface MetaDataBaseObject {
    flow_id: string;
    ts_epoch: number;
    tags?: string[];
  }

export interface RunInfo {
  workflowName: string;
  feedSel: string;
  runId: number;
  runStartTime: string;
  attemptId: number;
  attemptStartTime: string;
  parallelism: number;
  streaming: boolean;
  runStateFormatVersion?: number;
}   



export class Row implements MetaDataBaseObject {
    flow_id: string;
    step_name: string;
    run_number: number;
    attempt_id: number;
    task_id: number;
    ts_epoch: number;
    status: TaskStatus;
    started_at: Date;
    finished_at: Date;
    duration: number;
    message: string;
    tags?: string[] | undefined;
    task_name?: string;
    details: Action;
    /**
     * Where an unfinished phase is taken to end. Undefined while the attempt is still in flight,
     * in which case an unfinished phase runs up to now; for a finalised attempt it is the last
     * moment the state file has any evidence for (see Attempt). Without it, an action that was
     * cancelled before it could record an end timestamp appears to have run until today.
     */
    endAnchor?: number;

    constructor(appName: string, action: Action, actionName: string, endAnchor?: number) {
      this.flow_id = appName;
      this.step_name = actionName;
      this.run_number = action.executionId.runId;
      this.attempt_id = action.executionId.attemptId;
      this.task_id = 1;
      this.status = action.state as TaskStatus;
      this.message = action.msg;
      this.ts_epoch = (action.startTstmpPrepare || action.startTstmpInit || action.startTstmp || new Date(Date.now())).getTime();
      this.started_at = new Date(this.ts_epoch);
      this.finished_at =
        (action.startTstmp ? action.endTstmp : action.startTstmpInit ? action.endTstmpInit : action.endTstmpPrepare) ||
        new Date(endAnchor ?? Date.now());
      this.duration = durationMillis(action.duration === 'PT0S' ? 'PT0.001S' : action.duration);
      this.details = action;
      this.endAnchor = endAnchor;
    }

    /**
     * Row id might come as string or number. Make sure we have string
     */
    getTaskId(): string {
      return this.step_name;
    }

    /**
     * Where a phase that recorded no end is taken to stop: the attempt's anchor if it is
     * finalised, otherwise now, so a phase of a live run keeps growing.
     */
    private phaseEnd(recorded?: Date): number {
      return recorded?.getTime() ?? this.endAnchor ?? Date.now();
    }

    /**
     * Duration of the exec phase. A phase still in flight is measured up to now; one that was
     * abandoned without an end timestamp is measured up to the attempt's last known timestamp.
     */
    getDuration(): number | null {
      const { startTstmp, endTstmp } = this.details;
      return startTstmp ? this.phaseEnd(endTstmp) - startTstmp.getTime() : this.duration;
    }

    getDurationInit(): number | null {
      const { startTstmpInit, endTstmpInit } = this.details;
      return startTstmpInit ? this.phaseEnd(endTstmpInit) - startTstmpInit.getTime() : null;
    }

    getDurationPrepare(): number | null {
      const { startTstmpPrepare, endTstmpPrepare } = this.details;
      return startTstmpPrepare ? this.phaseEnd(endTstmpPrepare) - startTstmpPrepare.getTime() : null;
    }
  }
  
  export type TaskStatus =  'PENDING' | 'PREPARING' | 'PREPARED' | 'INITIALIZING' | 'INITIALIZED' | 'RUNNING' | 'FAILED' | 'SUCCEEDED' | 'SKIPPED' | 'CANCELLED' | 'UNKNOWN';

  /**
   * A state file as delivered by fetchAPI.getRun.
   * Timestamps are parsed into Date by the fetchAPI implementation (see processRun).
   */
  export type StateFile = {
    appConfig : {
      feedSel : string,
      applicationName : string,
      configuration : string | string[],
      master?: string,
      deployMode?: string,
      parallelism : number,
      statePath : string,
      streaming : boolean
    },
    runId : number,
    attemptId : number,
    runStartTime : Date,
    attemptStartTime : Date,
    runEndTime?: Date,
    actionsState: ActionsState,
    isFinal?: boolean,
    runStateFormatVersion?: number,
    sdlbVersionInfo?: VersionInfo,
    appVersionInfo?: VersionInfo,
    buildVersionInfo?: VersionInfo,
    appVersion?: string
  } 
  
  export type ActionsState = {
    [actionName: string]: Action
  }
  
  export interface Action {
    executionId : {
      type : string,
      runId : number,
      attemptId : number
    },
    state : string,
    duration: string,
    msg: string,
    results: Results,
    startTstmp : Date,
    endTstmp?: Date,
    startTstmpPrepare? : Date,
    endTstmpPrepare?: Date,
    startTstmpInit? : Date,
    endTstmpInit?: Date,
    inputIds?: string[],
    outputIds?: string[],
  }
  export type Results = [{
    type: string,
    dataObjectId: string,
    partitionValues: any[],
    isSkipped?: boolean,
    isDAGStart?: boolean,
    isDummy?: boolean,
    metrics?: {
      stage?: string,
      count?: number, 
      num_tasks?: number,
      no_data?: boolean,
      records_written?: number,
      stage_duration?: string,
      bytes_written?: number,
    }
  }]

  /**** Workflows and their runs as delivered by fetchAPI ****/

  /** Version information of SDLB or of the application, as recorded in a state file */
  export interface VersionInfo {
    version?: string;
  }

  /**
   * Summary of a workflow (SDLB application), as delivered by fetchAPI.getWorkflows.
   * The "last..." attributes describe the most recent attempt of the workflow.
   */
  export interface Workflow {
    name: string;
    numRuns: number;
    numAttempts: number;
    lastStatus?: TaskStatus;
    lastAttemptStartTime?: Date;
    lastDuration?: number; // milliseconds
    lastNumActions?: number;
  }

  /** Summary of an action of a WorkflowRun */
  export interface WorkflowRunAction {
    state: TaskStatus;
    dataObjects: string[]; // ids of the data objects written by this action
  }

  /**
   * One attempt of a workflow run, as delivered by fetchAPI.getWorkflowRuns,
   * getWorkflowRunsByAction and getWorkflowRunsByDataObject.
   * It is a summary of the corresponding state file (see StateFile), enriched with
   * attributes precalculated for the UI.
   */
  export interface WorkflowRun {
    name: string; // workflow name, e.g. appConfig.applicationName of the state file
    runId: number;
    attemptId: number;
    feedSel?: string;
    status?: TaskStatus; // status of the attempt, aggregated over all its actions
    runStartTime?: Date;
    attemptStartTime?: Date;
    runEndTime?: Date;
    actions?: { [actionName: string]: WorkflowRunAction };
    sdlbVersionInfo?: VersionInfo;
    appVersionInfo?: VersionInfo;
    buildVersion?: string | null; // fallback if sdlbVersionInfo is missing
    appVersion?: string | null; // fallback if appVersionInfo is missing
    path?: string; // relative path of the state file, used by the local state files backend
    /**** attributes precalculated for the UI ****/
    duration?: number; // milliseconds between attemptStartTime and runEndTime
    attemptStartTimeMillis?: number; // needed for HistoryBarChart
    actionsStatus?: Partial<Record<TaskStatus, number>>; // number of actions per state
    dataObjects?: string[]; // ids of all data objects written by this attempt
  }

  /**** Tenant administration ****/

  /** A user having access to a tenant, as delivered by fetchAPI.getUsers */
  export interface User {
    user_id: string;
    email: string;
    permissions: string[]; // see Permission in components/Settings/model/enums
  }

  /** License information of a tenant, as delivered by fetchAPI.getLicenses */
  export interface LicenseInfo {
    licensedRepos?: number;
    currentRepos?: number;
  }

  export type Flow = MetaDataBaseObject;
  
  export type RunStatus = {
    completed: string;
    running: string;
    failed: string;
  };
  
  export interface Run extends MetaDataBaseObject {
    run_number: number;
    run?: string;
    status: TaskStatus;
    finished_at?: number;
    run_id?: string;
    duration?: number;
  }

  export type QueryParam = string | null;
  
  /**** Entry of an element with their tstamp  ****/
  export interface TstampEntry {
    key: string;
    elementName: string;
    ts: number;
    tstamp: Date;
  }

  export interface SchemaColumn {
    name : string;
    dataType: string|SchemaArrayType|SchemaStructType;
    nullable?: boolean;
  }
  export interface SchemaArrayType {
    dataType: 'array';
    elementType: string|SchemaArrayType|SchemaStructType;
  }
  export interface SchemaStructType {
    dataType: 'struct';
    fields: SchemaColumn[];
  }
  export interface SchemaData{
    info?: string;
    schema?: SchemaColumn[];
  }
  
  export interface Stats {
    numFiles? : number;
    numRows? : number;
    numPartitions? : number;
    tableSizeInBytes?: string;
    columns?: {};
    sizeInBytes?: string;
    createdAt?: Date;
    lastModifiedAt?: Date;
  }
