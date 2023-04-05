import { TimelineMetrics } from '../../components/WorkflowsExplorer/Timeline/Timeline';
import { RowDataModel, StepRowData } from '../../components/WorkflowsExplorer/Timeline/useTaskData';
import { TaskSettingsState } from '../../components/WorkflowsExplorer/Timeline/useTaskListSettings';
import { Row, Step, Run, TaskStatus } from '../../types';

//
// LOT OF TESTS DEPEND ON THESE VALUES AS DEFAULTS SO DONT CHANGE THESE!!!
//
export function createTaskListSettings(partialGraph: Partial<TaskSettingsState>): TaskSettingsState {
  return {
    sort: ['startTime', 'asc'],
    stepFilter: [],
    statusFilter: null,
    group: true,
    isCustomEnabled: false,
    ...partialGraph,
  };
}

export function createTask(partialTask: Partial<Row>): Row {
  return {
    flow_id: 'BasicFlow',
    run_number: 1,
    step_name: 'start',
    task_id: 1,
    status: 'completed',
    user_name: 'SanteriCM',
    ts_epoch: 1595574762901,
    finished_at: 1595574762921,
    duration: 20,
    attempt_id: 0,
    tags: ['testingtag'],
    system_tags: ['user:SanteriCM', 'runtime:dev', 'python_version:3.7.6', 'date:2020-07-24', 'metaflow_version:2.0.5'],
    ...partialTask,
  };
}

export function createStep(_partialStep?: Partial<Step>): Step {
  return new Step
}

export function createRun(partialRun: Partial<Run>): Run {
  return {
    flow_id: 'BasicFlow',
    run_number: 1,
    user_name: 'SanteriCM',
    user: 'SanteriCM',
    ts_epoch: 1595574762958,
    tags: ['testingtag'],
    status: 'completed',
    system_tags: ['user:SanteriCM', 'runtime:dev', 'python_version:3.7.6', 'date:2020-07-24', 'metaflow_version:2.0.5'],
    ...partialRun,
  };
}

export function createTaskRow(tasks: Row | undefined): Row {
  return tasks || createTask({});
}


export function createStepRowData(
  rowdata: Partial<StepRowData>,
  step: Partial<Step>,
  tasks: Record<string, Row[]>,
): StepRowData {
  return {
    step: createStep(step),
    isOpen: true,
    status: 'completed' as TaskStatus,
    finished_at: 0,
    duration: 0,
    data: { '1': [createTask({})], ...tasks },
    ...rowdata,
  };
}

export function createRowDataModel(data: Record<string, StepRowData>): RowDataModel {
  return { start: createStepRowData({}, {}, {}), ...data };
}

export function createTimelineMetrics(data: Partial<TimelineMetrics>): TimelineMetrics {
  return {
    startTime: 0,
    endTime: 1000,
    visibleStartTime: 0,
    visibleEndTime: 1000,
    sortBy: 'startTime',
    groupingEnabled: true,
    ...data,
  };
}