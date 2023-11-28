import { fetchAPI } from "./fetchAPI";

export class fetchAPI_rest implements fetchAPI {
    url: string;

    constructor(url: string) {
        this.url = url;
    }

    private fetch(url: string) {
        return fetch(url, { mode: "cors" })
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

    getWorkflows = () => {
        return this.fetch(`${this.url}/workflows`)
            .catch((err) => console.log("Unexpected Server error: ", err));
    };  

    getWorkflowRuns = (name: string) => {
        return this.fetch(`${this.url}/workflow?name=${name}`);
    };
    
    getWorkflowRunsByAction = (name: string) => {
        // TODO
        return Promise.resolve([])
    };    

    getWorkflowRunsByDataObject = (name: string) => {
        // TODO
        return Promise.resolve([])
    };        
    
    getRun = (args: { name: string; runId: number; attemptId: number }) => {
        return fetch(`${this.url}/run?name=${args.name}&runId=${args.runId}&attemptId=${args.attemptId}`, { mode: "cors" })
        .then((res) => res.json());
    };
}
