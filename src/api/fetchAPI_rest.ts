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
        const res = await fetch(url, await this.getRequestInfo());
        if (res.ok) {
            return await res.json();
        }
        throw new Error(await res.text());
    }

    private processRuns(runs) {
        return runs.map((run) => {
            // convert date strings to date
            run.runStartTime = new Date(run.runStartTime);
            run.attemptStartTime = new Date(run.attemptStartTime);
            run.attemptStartTimeMillis = new Date(run.attemptStartTime).getTime(); // needed for HistorBarChart
            run.lastAttemptStartTime = new Date(run.lastAttemptStartTime);
            run.runEndTime = new Date(run.runEndTime);
            return run;
        });
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
        .then(runs => this.processRuns(runs))
        .catch(() => {
            return [];
        });
    };  

    getWorkflowRuns = (tenant: string, repo: string, env: string, application: string) => {
        return this.fetch(`${this.url}/workflow?tenant=${tenant}&repo=${repo}&env=${env}&application=${application}`)
        .then(runs => this.processRuns(runs));
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

    getConfig = async (tenant: string, repo: string, env: string, version: string|undefined) => {
        if (!version) throw new Error("fetchAPI for REST does not support getting config without version specified, but parameter version was undefined");
        return this.fetch(`${this.url}/config?tenant=${tenant}&repo=${repo}&env=${env}&version=${version}`)
        .then((parsedJson) => new ConfigData(parsedJson?.config ?? {}))
        .catch((error) => {
            console.log(error);
            return new ConfigData({});
        });
    };
    
    getConfigVersions = async (tenant: string, repo: string, env: string): Promise<string[] | undefined> => {
        return fetch(`${this.url}/versions?tenant=${tenant}&repo=${repo}&env=${env}`, await this.getRequestInfo())
        .then((res) => res.json());
    }

    getDescription = async (
        elementType: string | undefined,
        elementName: string | undefined,
        tenant: string,
        repo: string,
        env: string,
        version: string | undefined,
    ) => {
        const filename = `${elementType}/${elementName}.md`;
        const response = await this.getDescriptionFile(filename, tenant, repo, env, version);
        const responseBody = await response.json();
        if (!response.ok) {
            throw new Error(responseBody["detail"]);
        }
        return await this.resolveDescriptionImageUrls(responseBody.content, tenant, repo, env, version);
    };

    /**
     * For description .md files fetched from REST endpoint, images with relative URLs 
     * will be fetched from the same endpoint and their URLs will be resolved to blob URLs
     * 
     * E.g. On local, `![less flights more ...](images/train.png)`
     * will be fetched from `/api/v1/descriptions/images/train.png?tenant={tenant}&repo={repo}&env={env}&version={version}`
     * and will be resolved to `![less flights more ...](blob:http://localhost:5173/fe475b95-c790-4739-8169-ff09e3696462)`
     */
    private resolveDescriptionImageUrls = async (
        markdown: string,
        tenant: string,
        repo: string,
        env: string,
        version: string | undefined
    ) => {
        // Matches "![less flights more ...](images/train.png)"
        // Does not match
        // - "![Lorem Picsum](https://picsum.photos/200/300)"
        // - "![Lorem Picsum](http://picsum.photos/200/300)"
        // - "![Lorem Picsum](ftp://picsum.photos/200/300)"
        const regex = /(!\[.*?\]\()((?!https?|ftp).*)(\))/g;
        const promises: Array<Promise<any>> = [];
        const fileUrlMap: Map<string, string> = new Map();

        // Fetch and resolve all URLs
        const matches = markdown?.matchAll(regex);
        for (const match of matches) {
             // First capture group: "![less flights more ...]("
             // Second capture group: "images/train.png"
             // Last capture group: ")"
            const filename = match[2];
            const promise = this.getDescriptionFile(filename, tenant, repo, env, version).then((response) => {
                if (!response.ok) {
                    return response.json().then((error) => {
                        throw new Error(error["detail"]);
                    });
                }
                return response.blob().then((blob) => fileUrlMap.set(filename, URL.createObjectURL(blob)));
            });

            promises.push(promise);
        }
    
        await Promise.allSettled(promises);

        return markdown?.replace(regex, (_, $1, filename, $3) => {
            const fileUrl = fileUrlMap.get(filename) ?? filename;
            return `${$1}${fileUrl}${$3}`;
        } );
    }

    private getDescriptionFile = async (
        filename: string,
        tenant: string,
        repo: string,
        env: string,
        version: string | undefined
    ): Promise<any> => {
        return fetch(
            `${this.url}/descriptions/${filename}?tenant=${tenant}&repo=${repo}&env=${env}&version=${version}`,
            await this.getRequestInfo("GET", { Accept: "image/*,*/*;q=0.8" })
        );
    };

    getTstampEntries = async (type: string, subtype: string, elementName: string, tenant: string, repo: string, env: string): Promise<TstampEntry[] | undefined> => {
        return this.fetch(`${this.url}/dataobject/${subtype}/${elementName}/tstamps?tenant=${tenant}&repo=${repo}&env=${env}`)
        .then((parsedJson) =>
            parsedJson.map(
                (ts: number) =>
                    ({ key: `${elementName}.${subtype}.${ts}`, elementName: elementName, tstamp: new Date(ts) } as TstampEntry)
            )
        )
        .catch((error) => {
            console.log(error);
            return undefined;
        });
    }

    getSchema = async (schemaTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string) => {
        if (!schemaTstampEntry?.elementName || !schemaTstampEntry?.tstamp) return Promise.resolve(undefined);
        return this.fetch(`${this.url}/dataobject/schema/${schemaTstampEntry!.elementName}?tenant=${tenant}&repo=${repo}&env=${env}&tstamp=${schemaTstampEntry.tstamp.getTime()}`)
        .catch((error) => {
            console.log(error);
            return undefined;
        });
    }

    getStats = async (statsTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string) => {
        if (!statsTstampEntry?.elementName || !statsTstampEntry?.tstamp) return Promise.resolve(undefined);
        return this.fetch(`${this.url}/dataobject/stats/${statsTstampEntry!.elementName}?tenant=${tenant}&repo=${repo}&env=${env}&tstamp=${statsTstampEntry.tstamp.getTime()}`)
        .then((parsedJson) => parsedJson.stats)
        .catch((error) => {
            console.log(error);
            return undefined;
        });
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
