import { useEffect, useState } from "react";
import { fetchAPI_json_server } from "../api/fetchAPI_json_server";

export const api = new fetchAPI_json_server("http://localhost:3001");

export const useFetchWorkflows = () => {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.getWorkflows().then((data) => {
            setData(data);
            setIsLoading(false);
        });
    }, []);

    return { data, isLoading };
}

export const useFetchWorkflow = (workflow: string) => {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.getWorkflow(workflow).then((data) => {
            setData(data);
            setIsLoading(false);
        });
    }, []);

    return { data, isLoading };
}

export const useFetchRun = (name: string, runId: number, attemptId: number) => {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.getRun({name, runId, attemptId}).then((data) => {
            setData(data);
            setIsLoading(false);
        });
    }, []);

    return { data, isLoading };
}

export default useFetchWorkflows;