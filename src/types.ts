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


export type SortType = 'start time asc' | 'start time desc' | 'duration asc' | 'duration desc'

export class Row implements MetaDataBaseObject {
    getPhaseDuration(name: string) {
      throw new Error('Method not implemented.');
    }
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
   
    constructor(appName: string, action: Action, actionName: string) {
      this.flow_id = appName;
      this.step_name = actionName;
      this.run_number = action.executionId.runId;
      this.attempt_id = action.executionId.attemptId;
      this.task_id = 1;
      this.status = action.state as TaskStatus;
      this.message = action.msg;
      this.ts_epoch = (action.startTstmpPrepare || action.startTstmpInit || action.startTstmp).getTime();
      this.started_at = new Date(this.ts_epoch);
      this.finished_at = (action.startTstmp ? action.endTstmp : (action.startTstmpInit ? action.endTstmpInit : action.endTstmpPrepare)) || new Date(Date.now());
      this.duration = durationMillis(action.duration === 'PT0S' ? 'PT0.001S' : action.duration);
      this.details = action;
    }

    /**
     * Row id might come as string or number. Make sure we have string
     */
    getTaskId(): string {
      return this.step_name;
    }

    /**
     * Return task duration with handling for running state. If task is in running state, we want to compare its start time to
     * current time. Note that we are not camparing current time to ts_epoch field, which is just time for task object, not actual task time itself.
     */
    getDuration(): number | null {
      return this.details.startTstmp ? ((this.details.endTstmp?.getTime() || Date.now()) - this.details.startTstmp.getTime()) : this.duration;
    }

    getDurationInit(): number | null {
      return this.details.startTstmpInit ? ((this.details.endTstmpInit?.getTime() || Date.now()) - this.details.startTstmpInit.getTime()) : null;
    }

    getDurationPrepare(): number | null {
      return this.details.startTstmpPrepare ? ((this.details.endTstmpPrepare?.getTime() || Date.now()) - this.details.startTstmpPrepare.getTime()) : null;
    }
  }
  
  export type TaskStatus =  'PREPARING' | 'PREPARED' | 'INITIALIZING' | 'INITIALIZED' | 'RUNNING' | 'FAILED' | 'SUCCEEDED' | 'SKIPPED' | 'UNKNOWN';

  export type StateFile = {
    appConfig : {
      feedSel : string,
      applicationName : string,
      configuration : string,
      parallelism : number,
      statePath : string,
      streaming : boolean
    },
    runId : number,
    attemptId : number,
    runStartTime : string,
    attemptStartTime : string,
    actionsState: ActionsState,
    runStateFormatVersion?: number
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
