import { LicenseInfo, SchemaData, StateFile, Stats, TstampEntry, User, Workflow, WorkflowRun } from "../types";
import { ConfigData } from "../util/ConfigExplorer/ConfigData";

/**
 * The fetchApi interface is the skeletton for any API implementation. It methods must be implemented to create entry points for the data sources used by the UI.
 * The most important methods are the following:
 * @param getWorkflows: returns a summary of all workflows of a repository/environment, see Workflow
 * @param getWorkflowRuns: given a workflow name, the simplified history of that workflow is returned. It includes runId, attemptId, as well as other metrics used to display charts in the UI, see WorkflowRun
 * @param getRun: returns a statefile uniquely identified by workflow name, run ID and attempt ID, see StateFile
 * @param getConfig: returns the parsed SDLB configuration, see ConfigData
 *
 * A specific implementation must return the data that is needed by the UI. For an example, see the "fetchAPI_local_statefiles.ts" implementation
 */
export interface fetchAPI {
    getWorkflows: (tenant: string, repo: string, env: string) => Promise<Workflow[]>;
    getWorkflowRuns: (tenant: string, repo: string, env: string, application: string) => Promise<WorkflowRun[]>;
    getWorkflowRunsByAction: (name: string) => Promise<WorkflowRun[]>;
    getRun: (tenant: string, repo: string, env: string, application: string, runId: number, attemptId: number) => Promise<StateFile>;
    getWorkflowRunsByDataObject: (name: string) => Promise<WorkflowRun[]>;
    getConfig: (tenant: string, repo: string, env: string, version: string | undefined) => Promise<ConfigData>;
    getConfigVersions: (tenant: string, repo: string, env: string) => Promise<string[] | undefined>;
    /** returns the description of an element as Markdown text */
    getDescription: (elementType: string | undefined, elementName: string | undefined, tenant: string, repo: string, env: string, version: string | undefined) => Promise<string | undefined>;
    getTstampEntries: (type: string, subtype: string, elementName: string, tenant: string, repo: string, env: string) => Promise<TstampEntry[] | undefined>;
    getSchema(schemaTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string): Promise<SchemaData | undefined>;
    getStats(statsTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string): Promise<Stats  | undefined>;
    getUsers: (tenant: string) => Promise<User[]>;
    addUser: (tenant: string, email: string, access: string) => Promise<void>;
    removeUser: (tenant: string, email: string) => Promise<void>;
    getTenants: () => Promise<string[]>
    getRepos: (tenant: string) => Promise<string[]>
    getEnvs: (tenant: string, repo: string) => Promise<string[]>
    getLicenses: (tenant: string) => Promise<LicenseInfo>;
    clearCache: () => void;
}
