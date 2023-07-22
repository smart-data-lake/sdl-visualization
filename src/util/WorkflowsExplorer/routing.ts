import { Row } from '../../types';

type PathValue = string | number;

export const getPath = {
  step: (flowId: PathValue, runNumber: PathValue, stepName: PathValue): string =>
  `/${flowId}/${runNumber}/view/timeline?steps=${stepName}`,
  dag: (flowId: PathValue, runNumber: PathValue): string => `/${flowId}/${runNumber}/view/dag`,
  timeline: (flowId: PathValue, runNumber: PathValue): string => `/${flowId}/${runNumber}/view/timeline`,
  runSubView: (flowId: PathValue, runNumber: PathValue, taskId: PathValue, view: string): string => `/workflows/run/${flowId}/${runNumber}/${taskId}/${view}`,
  tasks: (flowId: PathValue, runNumber: PathValue): string => `/workflows/run/${flowId}/${runNumber}/view/task`,
  task: (flowId: PathValue, runNumber: PathValue, stepName: PathValue, taskId: PathValue): string =>
    `/workflows/${flowId}/${runNumber}/${taskId}/timeline/${stepName}`,
    run: (flowId: PathValue, runNumber: PathValue): string => `/${flowId}/${runNumber}`,
  notifications: (): string => '/notifications',
  debug: (): string => '/debug',
  home: (): string => '/',
};

export const getPathFor = {
  task: (item: Row): string =>
  `/workflows/${item.flow_id}/${item.run_number}/${item.task_id}/timeline/${item.step_name}`,
  attempt: (item: Row): string =>
  `/workflows/${item.flow_id}/${item.run_number}/${item.task_id}/timeline/${item.step_name}`,
};