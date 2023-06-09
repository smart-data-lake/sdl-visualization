import { fetchAPI } from "./fetchAPI";
import { fetchAPI_local_statefiles } from "./fetchAPI_local_statefiles";
import { fetchAPI_rest } from "./fetchAPI_rest";

const fetchAPITypes = {
    local: fetchAPI_local_statefiles,
    rest: fetchAPI_rest,
}

class Loader {
    public static getFetcher(name: string) : new (url: string) => fetchAPI {
        return fetchAPITypes[name] as new (url: string) => fetchAPI;
    }
}

export class Fetcher implements fetchAPI {
    fetcher: Promise<fetchAPI>;

    constructor() {
        this.fetcher = this.selectFetchAPI()
    }

    config = async () => {
        const manifest = await fetch('manifest.json');
        const manifest_json = await manifest.json();
        return {
            backendConfig: manifest_json.backendConfig,
            statefilesIndex: manifest_json?.statefilesIndex,
            congigfilesIndex: manifest_json?.statefilesIndex,
        }
    }   

    selectFetchAPI = async () => {
        const config = await this.config()
        const fetchType = config.backendConfig.split(';')[0];
        const url = config.backendConfig.split(';')[1];

        return new (Loader.getFetcher(fetchType))(url);
    } 

    getWorkflows = async () => {
        return (await this.fetcher).getWorkflows()
    };
    
    
    getWorkflow = async (name: string) => {
        return (await this.fetcher).getWorkflow(name);
    };
    
    
    getRun = async (args: {name: string, runId: number, attemptId: number}) => {
        return (await this.fetcher).getRun(args)
    };    
}