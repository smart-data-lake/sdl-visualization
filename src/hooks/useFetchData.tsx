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

export const useFetchWorkflow = () => {

}

export const useFetchRun = () => {

}

export default useFetchWorkflows;