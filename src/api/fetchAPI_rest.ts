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

    getWorkflows = () => {
        return this.fetch(`${this.url}/workflows`)
            .catch(() => {
                return [];
            });
    };  

    getWorkflowRuns = (name: string) => {
        return this.fetch(`${this.url}/workflow?name=${name}`);
    };

    getRun = async (args: { name: string; runId: number; attemptId: number }) => {
        return fetch(`${this.url}/run?name=${args.name}&runId=${args.runId}&attemptId=${args.attemptId}`, await this.getRequestInfo())
        .then((res) => res.json());
    };

    getUsers = async (tenant: string) => {
        return fetch(`${this.url}/users/${tenant}`, await this.getRequestInfo())
        .then((res) => res.json());
    }

    addUser = async (tenant: string, email: string, access: string) => {
        const requestInfo = await this.getRequestInfo('POST', {'Content-Type': 'application/json'});
        requestInfo.body = JSON.stringify({email, access});
        return fetch(`${this.url}/users/${tenant}`, requestInfo)
    }
}
