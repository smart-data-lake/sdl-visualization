import { useEffect, useState } from "react";

/**
 * The useFetchData hook is used to fetch data from the backend. It returns the data as a json object.
 * If not specified, the base url is set to 'http://localhost:3001/'.
 * @param arg 
 * @param base 
 * @param callBack 
 * @returns 
 */
const useFetchData = (arg: string, base?: string, callBack?: () => void) => {
    const [data, setData] = useState(null);
    if (!base) base = 'http://localhost:3001/';

    useEffect(() => {
        fetch(base + arg)
            .then(res => res.json())
            .then(data => {
                setData(data);
                if (callBack) callBack();
            })
    }, [])
        
    return data as any;
}

export const usePromiseAll = (arg: string, base?: string, callBack?: () => void) => {
    const [index, setIndex] = useState<Record<string, any>[]>([]);
    const [data, setData] = useState<Record<string, any>[]>([]);
    
    if (!base) base = 'http://localhost:3001/';
    
    useEffect(() => {
        const getUrls = () => {
            fetch(base + arg)
                .then(res => res.json())
                .then(index => {
                    setIndex(index);
                    if (callBack) callBack();
                })
            return index.map((elem) => {return elem.name})
        }

        const getAll = (urls: any[]) => {
            Promise.all(
                urls.map((url) =>
                    fetch(url).then((response) => {
                            if (!response.ok) {
                                throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                            }
                            return response.json();
                        }
                    )))
                    .then((jsonArray) => {
                        // Concatenate all JSON arrays into a single array
                        const combinedArray = jsonArray.reduce((acc, curr) => acc.concat(curr), []);
                        setData(combinedArray);
                    })
                    .catch((error) => {
                        console.error(error);
                    });
            }

            const urls = getUrls();
            getAll(urls);

        }, []);

        return data;
}

export const useFetchDataFromIndex = (arg: string, base?: string, callBack?: () => void) => {
    const [index, setIndex] = useState<Record<string, any>[]>([]);
    const [data] = useState<Record<string, any>[]>([]);
    if (!base) base = 'http://localhost:3001/';

    useEffect(() => {
        const getIndex = async () => {
            fetch(base + arg)
                .then(res => res.json())
                .then(index => {
                    setIndex(index);
                    if (callBack) callBack();
                })
        }

        const getData = async (urls: (RequestInfo | URL)[]) => {
            const responses = await Promise.all(urls.map((url: RequestInfo | URL) => fetch(url)));
            const jsonResponses = await Promise.all(responses.map(response => {response.json(); console.log(response.json())}));
            const res = await Promise.all(jsonResponses.map(jsonResponse => console.log(jsonResponse)))
            console.log(res)
        }

        getIndex();
        const urls = index.map(elem => {return elem.name});
        getData(urls);
    }, [])
        
    return data as any;
}


export default useFetchData;