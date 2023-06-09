/**
 * The fetchApi interface is the skeletton for any API implementation. It methods must be implemented to create entry points for the 3 main data sources used by the UI.
 * The methods are the following:
 * @param getWorkflows: () => Promise<any> : simply returns an object containing all the workflows of the project 
 * @param getWorkflow: (name: string) => Promise<any> : given a name, the simplified history of a specific workflow is returned. It includes runId, attemptId, as well as other metrics used to display charts in the UI
 * @param getRun: (args: {name: string, runId: number, attemptId: number}) => Promise<any> : returns a statefile uniquely identified by workflow name, run ID, and attempt ID.
 * 
 * A specific implementation must return the data that is needed by the UI. For an example, see the "fetchAPI_local_statefiles.ts" implementation 
 */
export interface fetchAPI {
    url?: string;

    getWorkflows: () => Promise<any>;
    getWorkflow: (name: string) => Promise<any>;
    getRun: (args: {name: string, runId: number, attemptId: number}) => Promise<any>;
}