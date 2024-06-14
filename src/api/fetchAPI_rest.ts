import { Auth } from "aws-amplify";
import { fetchAPI } from "./fetchAPI";

export class fetchAPI_rest implements fetchAPI {
    url: string;

    constructor(url: string) {
        this.url = url;
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

    clearCache = () => undefined    

    getUsers = async (tenant: string) => {
        return fetch(`${this.url}/users?tenant=${tenant}`, await this.getRequestInfo())
        .then((res) => res.json());
    }

    addUser = async (tenant: string, email: string, access: string) => {
        const requestInfo = await this.getRequestInfo('POST', {'Content-Type': 'application/json'});
        requestInfo.body = JSON.stringify({email, access});
        return fetch(`${this.url}/users?tenant=${tenant}`, requestInfo)
    }

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
