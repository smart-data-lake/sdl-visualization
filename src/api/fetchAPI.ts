import { SchemaData, Stats, TstampEntry } from "../types";
import { ConfigData } from "../util/ConfigExplorer/ConfigData";

/**
 * The fetchApi interface is the skeletton for any API implementation. It methods must be implemented to create entry points for the 3 main data sources used by the UI.
 * The methods are the following:
 * @param getWorkflows: () => Promise<any> : simply returns an object containing all the workflows of the project 
 * @param getWorkflowRuns: (name: string) => Promise<any> : given a name, the simplified history of a specific workflow is returned. It includes runId, attemptId, as well as other metrics used to display charts in the UI
 * @param getRun: (name: string, runId: number, attemptId: number) => Promise<any> : returns a statefile uniquely identified by workflow name, run ID, and attempt ID.
 * 
 * A specific implementation must return the data that is needed by the UI. For an example, see the "fetchAPI_local_statefiles.ts" implementation 
 */
export interface fetchAPI {
    getWorkflows: (tenant: string, repo: string, env: string) => Promise<any[]>;
    getWorkflowRuns: (tenant: string, repo: string, env: string, application: string) => Promise<any>;
    getWorkflowRunsByAction: (name: string) => Promise<any>;
    getRun: (tenant: string, repo: string, env: string, application: string, runId: number, attemptId: number) => Promise<any>;
    getWorkflowRunsByDataObject: (name: string) => Promise<any>;
    getConfig: (tenant: string, repo: string, env: string, version: string | undefined) => Promise<ConfigData>;
    getConfigVersions: (tenant: string, repo: string, env: string) => Promise<string[] | undefined>;
    getDescription: (elementType: string | undefined, elementName: string | undefined, tenant: string, repo: string, env: string, version: string | undefined) => Promise<any>;
    getTstampEntries: (type: string, subtype: string, elementName: string, tenant: string, repo: string, env: string) => Promise<TstampEntry[] | undefined>;
    getSchema(schemaTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string): Promise<SchemaData | undefined>;
    getStats(statsTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string): Promise<Stats  | undefined>;
    getUsers: (tenant: string) => Promise<any>;
    addUser: (tenant: string, email: string, access: string) => Promise<any>;
    removeUser: (tenant: string, email: string) => Promise<any>;
    getTenants: () => Promise<string[]>
    getRepos: (tenant: string) => Promise<any[]>
    getEnvs: (tenant: string, repo: string) => Promise<any[]>
    getLicenses: (tenant: string) => Promise<any>;
    clearCache: () => void;
}