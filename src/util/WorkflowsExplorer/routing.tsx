import React from 'react';
import { createHashRouter, createRoutesFromElements, Route } from 'react-router-dom';
import ConfigViewer from '../../components/ConfigExplorer/ConfigExplorer';
import RunOverview from '../../components/WorkflowsExplorer/Run/RunOverview';
import WorkflowHistory from '../../components/WorkflowsExplorer/Workflow/WorkflowHistory';
import Workflows from '../../components/WorkflowsExplorer/Workflows/Workflows';
import NotFound from '../../layouts/NotFound';
import RootLayout from '../../layouts/RootLayout';
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

export const router = createHashRouter(
    createRoutesFromElements(
      <Route path='/' element={<RootLayout/>}>{/* 
        <Route path='/configviewer' element={<ConfigViewer/>}/> */}
        <Route path='/workflows/' element={<Workflows/>}/>
        <Route path='/workflows/:workflow' element={<WorkflowHistory/>}/>
        <Route path='/workflows/:flowId/:runNumber/:taskId/:tab' element={<RunOverview/>}/>
        <Route path='/workflows/:flowId/:runNumber/:taskId/:tab/:stepName' element={<RunOverview panelOpen={true}/>}/>
        <Route path='*' element={<NotFound/>}/>
      </Route>
    )
)