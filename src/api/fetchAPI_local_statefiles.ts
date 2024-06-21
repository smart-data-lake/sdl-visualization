import { SchemaData, Stats, TstampEntry } from "../types";
import { ConfigData } from "../util/ConfigExplorer/ConfigData";
import { getUrlContent, listConfigFiles, parseTextStrict, readConfigIndexFile } from "../util/ConfigExplorer/HoconParser";
import { compareFunc, formatFileSize, onlyUnique } from "../util/helpers";
import { fetchAPI } from "./fetchAPI";

export class fetchAPI_local_statefiles implements fetchAPI {
    
    statePath: string = "./state";
    baseUrl: string | undefined;
    env: string | undefined;

    constructor(path: string, baseUrl: string | undefined, env: string | undefined) {
        if (path) this.statePath = path;
        this.baseUrl = baseUrl;
        this.env = env;
    }

    getUsers(tenant: string) {
        return new Promise((r) => r([]));
    };

    // cache index for reuse in getRun
    _index: Promise<any[]> | undefined;
    getIndex() {
        const indexPath = this.statePath + "/index.json";
        this._index = fetch(indexPath)
        // note that index.json is json lines file
        .then(res => res.text())
        .then(res => res.split("\n")
                        .filter(obj => obj.trim().length > 0)
                        .map(obj => JSON.parse(obj)))
        .then(runs => runs
            .map(run => {
                // convert date strings to date
                run.runStartTime = new Date(run.runStartTime);
                run.attemptStartTime = new Date(run.attemptStartTime);
                run.attemptStartTimeMillis = new Date(run.attemptStartTime).getTime(); // needed for HistoBarChart
                run.runEndTime = new Date(run.runEndTime);
                run.duration = run.runEndTime.getTime() - run.attemptStartTime.getTime();
                // precalc count by status
                run.actionsStatus = Object.values((run.actions || {}) as object)
                .map(action => action.state)
                .reduce((group: {[key: string]: number}, state) => {
                    if (!group[state]) group[state] = 1;
                    else group[state] += 1;
                    return group;
                }, {})
                // precalc list of dataObjects written
                run.dataObjects = Object.values((run.actions || {}) as object)
                .map(action => action.dataObjects).flat()
                return run;
            })
        )
        .then(runs => {console.log(`got ${runs.length} runs`); return runs})
        .catch(err => {
            console.error(`Could not load index file ${indexPath}`, err);
            throw err;
        });
        return this._index;
    }
    
    reuseIndex() {
        if (this._index) return this._index;
        else return this.getIndex()
    }

    groupByWorkflowName(data: any[]) {
        return data.reduce((group: {[key: string]: any[]}, run) => {
            if (!group[run.name]) group[run.name] = [];
            group[run.name].push(run);
            return group;
        }, {});
    }

    getWorkflows = async (tenant: string, repo: string, env: string) => {
        return this.reuseIndex()
        .then(data => {
            const workflows = this.groupByWorkflowName(data);
            return Object.entries(workflows).map(([name,runs]) => {
                const lastRun = runs.sort(compareFunc("attemptStartTime"))[runs.length - 1];
                const lastNumActions = Object.values(lastRun.actionsStatus || {}).map(x => x as number).reduce((sum,x) => sum+x, 0);
                return {
                    "name": name,
                    "numRuns": runs.map(run => run.runId).filter(onlyUnique).length,
                    "numAttempts": runs.length,                    
                    "lastDuration": lastRun.duration,
                    "lastAttemptStartTime": lastRun.attemptStartTime,
                    "lastStatus": lastRun.status,
                    "lastNumActions": lastNumActions
                }
            })
        })
    };
    
    
    getWorkflowRuns = async (tenant: string, repo: string, env: string, application: string) => {
        return this.reuseIndex()
        .then(data => {
            const runs = data
            .filter(run => run.name === application)
            .sort(compareFunc('attemptStartTime'));
            return runs
        })
    };


    getWorkflowRunsByAction = async (name: string) => {
        return this.reuseIndex()
        .then(data => {
            const runs = data
            .filter(run => Object.keys(run.actions || {}).some(x => x === name))
            .sort(compareFunc('attemptStartTime'));
            return runs
        })
    };        

    getWorkflowRunsByDataObject = async (name: string) => {
        return this.reuseIndex()
        .then(data => {
            const runs = data
            .filter(run => (run.dataObjects as any[]).some(x => x === name))
            .sort(compareFunc('attemptStartTime'));
            return runs
        })
    };    
    
    getRun = async (args: {tenant: string, repo: string, env: string, application: string, runId: number, attemptId: number}) => {            
        return this.reuseIndex()
        .then(data => data.filter(run => (run.name === args.application && run.runId === args.runId && run.attemptId === args.attemptId))[0])
        .then(val => { 
            if (!val) console.log("getRun not found", args.application, args.runId, args.attemptId);
            return fetch(this.statePath + '/' + val.path)
                    .then(res => res.json())
        })        
    };

    getConfig(tenant: string, repo: string, env: string, version: string): Promise<{config: ConfigData}> {
        const baseUrl = this.baseUrl ?? "./";
        const exportedConfigUrl = baseUrl + "exportedConfig.json";
        const configUrl = baseUrl + "config";
        const envConfigUrl = baseUrl + "envConfig";
    
        // a) search for exported config in json format
        return getUrlContent(exportedConfigUrl)
          .then((jsonStr) => JSON.parse(jsonStr))
          .catch((err) => {
            console.log(
              "Could not get exported config in json format " +
                exportedConfigUrl +
                ", will try listing hocon config files. (" +
                err +
                ")"
            );
            // b) parse config from Hocon Files
            console.log("reading config from url " + configUrl);
            // b1) get config file list by listing config directory
            return listConfigFiles(configUrl, "/")
              .catch((err) => {
                // b2) read config file list from static index.json
                console.log("Could not list files in URL " + configUrl + ", will try reading index file. (" + err + ")");
                return readConfigIndexFile(configUrl);
              })
              .then((files) => {
                // prepend config directory to files to create relative Url
                const filesRelUrl = files.map((f) => configUrl + "/" + f);
                // add environment config file if existing
                if (this.env) {
                  const envConfigRelUrl = envConfigUrl + "/" + this.env + ".conf";
                  // make sure envConfig Url exists
                  return getUrlContent(envConfigRelUrl).then((_) => {
                    filesRelUrl.push(envConfigRelUrl);
                    return filesRelUrl;
                  });
                } else {
                  return filesRelUrl;
                }
              })
              .then((files) => {
                console.log("config files to read", files);
                const includeText = files.map((f) => `include "${window.location.origin}/${f}"`).join("\n");
                return parseTextStrict(includeText);
              });
          })
          .then((parsedConfig) => ({ config: new ConfigData(parsedConfig) }));
    }

    getTstampFromFilename(filename: string): Date {
        const matches = filename.match(/\.([0-9]+)\./);
        if (!matches || matches.length < 2) {
            throw new Error("Cannot parse timestamp from filename " + filename);
        }
        return new Date(parseInt(matches[1]) * 1000);
    }

    getTstampEntries(type: string, subtype: string, elementName: string, tenant: string, repo: string, env: string): Promise<TstampEntry[] | undefined> {
        const filename = `/${type}/${elementName}.${subtype}.index`;
        console.log("fetching file " + filename);
        return getUrlContent(filename)
            .then((content: string) =>
                content
                .split(/\r?\n/)
                .filter((e) => e.length > 0)
                .map((e) => {
                    return { key: e, elementName: elementName, tstamp: this.getTstampFromFilename(e) } as TstampEntry;
                })
                .reverse()
            )
            .catch((error) => { console.log(error, filename); return undefined; });
    }

    getSchema(schemaTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string) {
        if (!schemaTstampEntry?.key) return Promise.resolve(undefined);
        const filename = "/schema/" + schemaTstampEntry!.key; //file must be in public/schema folder
        return getUrlContent(filename)
            .then((str) => JSON.parse(str) as SchemaData)
            .catch((error) => { console.log(error); return undefined; });
    }

    getStats(statsTstampEntry: TstampEntry | undefined, tenant: string, repo: string, env: string) {
        if (!statsTstampEntry?.key) return Promise.resolve(undefined);
        const filename = "/schema/"+ statsTstampEntry!.key; //file must be in public/schema folder
        return getUrlContent(filename)
            .then((str) => {
                const obj = JSON.parse(str)
                Object.keys(obj).forEach((key) => {
                    if (key.endsWith("At") && typeof obj[key] === "number") obj[key] = new Date(obj[key]);
                    if (key.endsWith("InBytes") && typeof obj[key] === "number") obj[key] = formatFileSize(obj[key]!);
                })
                return obj as Stats;
            })
            .catch((error) => { console.log(error); return undefined; });
    }

    clearCache = () => {
        this._index = undefined;
    };
    
    addUser(tenant: string, email: string, access: string) {
        return new Promise((r) => r({}));
    }

    removeUser(tenant: string, email: string) {
        return new Promise((r) => r({}));
    }

    getTenants() {
        return new Promise<string[]>(r => r([]))
    }

    getRepos(tenant: string): Promise<any[]> {
        return new Promise((r) => r([]));
    }
  
    getEnvs(tenant: string, repo: string): Promise<any[]> {
        return new Promise((r) => r([]));
    }
}