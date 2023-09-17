import { durationMillis } from "./util/WorkflowsExplorer/date";

export type AttemptConfig = {
    name: string;
    runId : number;
    attemptId : number;
    runStartTime : Date;
    attemptStartTime : Date;  
};

export type AttemptType = {
    stateFile: StateFile; 
    name: string;
    runId: number;
    runStartTime: string; 
    rows: Row[];
    run: Run;
}

export interface MetaDataBaseObject {
    flow_id: string;
    user_name: string;
    ts_epoch: number;
    tags?: string[];
    system_tags: string[];
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
    user_name: string;
    system_tags: string[];
    started_at: number;
    finished_at: number;
    duration: number;
    metadata: Metadata;
    message: string;
    tags?: string[] | undefined;
    run_id?: string;
    task_name?: string;
    foreach_label?: string;
    endTstmp?: number;
    startTstmpPrepare? : number;
    endTstmpPrepare?: number;
    startTstmpInit? : number;
    endTstmpInit?: number;
    inputIds?: {id: string}[];
    outputIds?: {id: string}[];
   
    constructor({ properties }: { properties: TaskProperty; }) {
      this.flow_id = properties.runInfo.workflowName;
      this.step_name = properties.actionName;
      this.run_number = properties.action.executionId.runId;
      this.attempt_id = properties.action.executionId.attemptId;
      this.ts_epoch = new Date(properties.action.startTstmp).getTime();
      this.status = properties.action.state as TaskStatus;
      this.started_at = this.ts_epoch;
      this.duration = durationMillis(properties.action.duration === 'PT0S' ? 'PT0.001S' : properties.action.duration);
      this.finished_at = this.started_at + (this.duration === 0 ? 1 : this.duration);
      this.metadata = properties.action.results;
      this.task_id = properties.runInfo.attemptId;
      this.user_name = '';
      this.system_tags = [];
      this.message = properties.action.msg;
      this.endTstmp = properties.action.endTstmp ? new Date(properties.action.endTstmp).getTime() : undefined;
      this.startTstmpPrepare = properties.action.startTstmpPrepare ? new Date(properties.action.startTstmpPrepare).getTime() : undefined;
      this.endTstmpPrepare = properties.action.endTstmpPrepare ? new Date(properties.action.endTstmpPrepare).getTime() : undefined;
      this.startTstmpInit = properties.action.startTstmpInit ? new Date(properties.action.startTstmpInit).getTime() : undefined;
      this.endTstmpInit = properties.action.endTstmpInit ? new Date(properties.action.endTstmpInit).getTime() : undefined;
      this.inputIds = properties.action.inputIds;
      this.outputIds = properties.action.outputIds;
      console.log(this);
    }

    /**
     * Row id might come as string or number. Make sure we have string
     */
    getTaskId(): string {
      return this.step_name;
    }

    /**
     * Return task duration with hadnling for running state. If task is in running state, we want to compare its start time to
     * current time. Note that we are not camparing current time to ts_epoch field, which is just time for task object, not actual task time itself.
     */
    getTaskDuration(): number | null {
      return this.status === 'RUNNING' && this.started_at
        ? Date.now() - this.started_at
        : this.duration
        ? this.duration
        : null;
    }
  }
  
  
  export type TaskStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'PREPARED' | 'INITIALIZED';
  
  export interface TaskProperty {
    runInfo: RunInfo,
    action: Action,  
    actionName: string;
  }
  
  export type RunParams = {
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
  }
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
    startTstmp : string,
    duration: string,
    msg: string,
    results: Metadata,
    actionFinishTime?: number,
    endTstmp?: string,
    startTstmpPrepare? : string,
    endTstmpPrepare?: string,
    startTstmpInit? : string,
    endTstmpInit?: string,
    inputIds?: {id: string}[],
    outputIds?: {id: string}[],
  }
  export type Metadata = [{
    subFeed?: {
      type?: string,
      dataObjectId?: string,
      partitionValues?: any[],
      isSkipped?: boolean,
      isDAGStart?: boolean,
      isDummy?: boolean,
    },
    mainMetrics?: {
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
    status: keyof RunStatus;
    user: string | null;
    finished_at?: number;
    run_id?: string;
    duration?: number;
  }
  
  export interface _Step extends MetaDataBaseObject {
    run_number: number;
    run_id?: string;
    step_name: string;
    finished_at?: number;
    duration?: number;
  }
  
  export class Step implements MetaDataBaseObject {
    run_number: number;
    run_id?: string;
    step_name: string;
    finished_at?: number;
    duration?: number;
    task_id: number;
    flow_id: string;
    user_name: string;
    ts_epoch: number;
    tags?: string[] | undefined;
    system_tags: string[];

    constructor() {
      this.run_number = -1;
      this.step_name = "tmp";
      this.task_id = -1;
      this.flow_id = "flowid";
      this.user_name = "Phill";
      this.ts_epoch = -1;
      this.system_tags = [];
    }
  }
  
  export interface RunParam {
    [key: string]: {
      value: string;
    };
  }
  
  export interface Log {
    row: number;
    line: string;
    timestamp?: number;
  }
  
  export type QueryParam = string | null;
  
  export type AsyncStatus = 'NotAsked' | 'Ok' | 'Error' | 'Loading';
  