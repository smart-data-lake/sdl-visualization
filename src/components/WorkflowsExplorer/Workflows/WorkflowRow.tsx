import React from "react";
import { useNavigate } from "react-router-dom";




const WorkflowRow = (props: {data: {id: number, name: string}}) => {
    const { data } = props;
    const navigate = useNavigate();
    
    const render = () => {
        return (
            <>
                <tr onClick={() => handleClick()}>
                    <td>{data.name}</td>
                    <td>{'?'}</td>
                    <td>{"Dummy field"}</td>
                    <td>{"Dummy field 2"}</td>
                </tr>
            </>
        )
    }

    const handleClick = () => {
        navigate('/workflows/' + data.name)
    }

    return (  
        <>
            {data && render()}
        </>
    );
}
 
export default WorkflowRow;
