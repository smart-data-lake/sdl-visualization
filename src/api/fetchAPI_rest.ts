import { Auth } from "aws-amplify";
import { fetchAPI } from "./fetchAPI";
import { ConfigData } from "../util/ConfigExplorer/ConfigData";
import { TstampEntry } from "../types";

export class fetchAPI_rest implements fetchAPI {
    url: string;
    baseUrl: string | undefined;
    env: string | undefined;

    constructor(url: string, baseUrl: string | undefined, env: string | undefined) {
        this.url = url;
        this.baseUrl = baseUrl;
        this.env = env;
    }

    private async fetch(url: string) {
        return fetch(url, await this.getRequestInfo())
            .then((res) => res.json())
            .then((runs) =>
            runs.map((run) => {
                // convert date strings to date
                run.runStartTime = new Date(run.runStartTime);
                run.attemptStartTime = new Date(run.attemptStartTime);
                run.attemptStartTimeMillis = new Date(run.attemptStartTime).getTime(); // needed for HistorBarChart
                run.runEndTime = new Date(run.runEndTime);
                run.duration =
                run.runEndTime.getTime() - run.attemptStartTime.getTime();
                return run;
            })
            );
    }

    private async getRequestInfo(method: string = 'GET', headers?: any): Promise<RequestInit> {
        try {
            const currentUserSession = await Auth.currentSession();
            return { mode: "cors", method, headers: {'Authorization': currentUserSession.getIdToken().getJwtToken(), ...headers}}
        } catch {
            return { mode: "cors", method, headers};
        }
    }

    getWorkflows = (tenant: string, repo: string, env: string) => {
        return this.fetch(`${this.url}/workflows?tenant=${tenant}&repo=${repo}&env=${env}`)
            .catch(() => {
                return [];
            });
    };  

    getWorkflowRuns = (tenant: string, repo: string, env: string, application: string) => {
        return this.fetch(`${this.url}/workflow?tenant=${tenant}&repo=${repo}&env=${env}&application=${application}`);
    };
    
    getWorkflowRunsByAction = (name: string) => {
        // TODO
        return Promise.resolve([])
    };    

    getWorkflowRunsByDataObject = (name: string) => {
        // TODO
        return Promise.resolve([])
    };        
    
    getRun = async (args: { tenant: string, repo: string, env: string, application: string; runId: number; attemptId: number }) => {
        return fetch(`${this.url}/state?tenant=${args.tenant}&repo=${args.repo}&env=${args.env}&application=${args.application}&runId=${args.runId}&attemptId=${args.attemptId}`, await this.getRequestInfo())
        .then((res) => res.json());
    };

    getConfig = async (tenant: string, repo: string, env: string, version: string) => {
        return fetch(
            `${this.url}/config?tenant=${tenant}&repo=${repo}&env=${env}&version=${version}`,
            await this.getRequestInfo()
        )
        .then((res) => res.json())
        .then((parsedJson) => ({ ...parsedJson, config: new ConfigData(parsedJson?.config ?? {}) }));
    };

    getTstampEntries = async (type: string, subtype: string, elementName: string, tenant: string, repo: string, env: string): Promise<TstampEntry[] | undefined> => {
        return fetch(
            `${this.url}/dataobject/${subtype}/${elementName}/tstamps?tenant=${tenant}&repo=${repo}&env=${env}`,
            await this.getRequestInfo()
        )
        .then((res) => res.json())
        .then((parsedJson) =>
            parsedJson.map(
                (ts: number) =>
                ({ key: `${elementName}.${subtype}.${ts}`, elementName: elementName, tstamp: new Date(ts) } as TstampEntry)
            )
        );
    }

    getSchema = async (schemaTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string) => {
        if (!schemaTstampEntry?.elementName || !schemaTstampEntry?.tstamp) return Promise.resolve(undefined);
        return fetch(
            `${this.url}/dataobject/schema/${schemaTstampEntry!.elementName}?tenant=${tenant}&repo=${repo}&env=${env}&tstamp=${schemaTstampEntry.tstamp.getTime()}`,
            await this.getRequestInfo()
        )
        .then((res) => res.json());
    }

    getStats = async (statsTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string) => {
        if (!statsTstampEntry?.elementName || !statsTstampEntry?.tstamp) return Promise.resolve(undefined);
        return fetch(
            `${this.url}/dataobject/stats/${statsTstampEntry!.elementName}?tenant=${tenant}&repo=${repo}&env=${env}&tstamp=${statsTstampEntry.tstamp.getTime()}`,
            await this.getRequestInfo()
        )
        .then((res) => res.json())
        .then((parsedJson) => parsedJson.stats);
    }

    clearCache = () => undefined    

    getUsers = async (tenant: string) => {
        const response = await fetch(`${this.url}/users?tenant=${tenant}`, await this.getRequestInfo());
        return await response.json();
    };
    
    addUser = async (tenant: string, email: string, access: string) => {
        const requestInfo = await this.getRequestInfo("POST", { "Content-Type": "application/json" });
        requestInfo.body = JSON.stringify({ email, access });
        const response = await fetch(`${this.url}/users?tenant=${tenant}`, requestInfo);
        const responseBody = await response.json();
        if (!response.ok) {
            throw new Error(responseBody["detail"]);
        }
        return responseBody;
    };
    
    removeUser = async (tenant: string, email: string) => {
        return await fetch(
            `${this.url}/users?tenant=${tenant}&email=${email}`,
            await this.getRequestInfo("DELETE", { "Content-Type": "application/json" })
        );
    };

    getTenants = async () => {
        return fetch(`${this.url}/tenants`, await this.getRequestInfo())
        .then((res) => res.json());
    }

    getRepos = async (tenant: string) => {
        return fetch(`${this.url}/repo?tenant=${tenant}`, await this.getRequestInfo())
        .then((res) => res.json());
    }

    getEnvs = async (tenant: string, repo: string) => {
        return fetch(`${this.url}/envs?tenant=${tenant}&repo=${repo}`, await this.getRequestInfo())
        .then((res) => res.json());
    }
}
