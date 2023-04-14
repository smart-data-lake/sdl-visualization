export interface fetchApi {
    url: string;

    getWorkflows: (args?:any) => Promise<any>;
    getWorkflow: (args?:any) => Promise<any>;
    getRun: (args?:any) => Promise<any>;
}