import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { StateFile } from "../../../types";

const RunsRow = (props : {run: {id: number, run: StateFile}}) => {
    const currURL = useLocation().pathname;
    const { id, run } = props.run;
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(currURL + '/' + id + '/' + run.attemptId + '/timeline')
    }

    return ( 
        <tr onClick={() => handleClick()}>
            <td>{id}</td>
            <td>{run.attemptId}</td>
            <td>{"Dummy field 1"}</td>
            <td>{"Dummy field 2"}</td>
        </tr>
     );
}
 
export default RunsRow;