import { useState } from "react"; 

export const getData = (base: string, args: string) => {
    const [data, setData] = useState([]);
    
    fetch(base + args)
        .then(res => res.json())
        .then(data => setData(data))
    
    return data;
}