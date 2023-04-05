import { Sheet, Table} from "@mui/joy";
import React from "react"
import ActionRow from "./ActionRow";
import { Row } from "../../types";


const ActionsTable = (props: { rows: Row[];}) => {
    const { rows } = props;
    
    const renderTable = (rows: Row[]) => {
        return (
            rows.map((row) => (
                <>
                    <ActionRow row={row}/>
                </>
            ))
        )
    }

    return (
        <Sheet
            sx={{
                display: 'flex', 
                justifyContent: 'space-between',
            }}
        >   
            <Sheet
                sx={{
                    height: '30rem', 
                    overflow: 'auto'
                }}
            >
                <Table size="sm" hoverRow color='neutral' stickyHeader>
                    <thead>
                        <tr>
                            <th><b>Name</b></th>
                            <th><b>Status</b></th>
                            <th style={{width: '15%'}}><b>Attempt</b></th>
                            <th style={{width: '15%'}}><b>Start</b></th>
                            <th style={{width: '15%'}}><b>Finish</b></th>
                            <th style={{width: '15%'}}><b>Duration</b></th>
                        </tr>
                    </thead>
                    <tbody>
                        {renderTable(rows)}
                    </tbody>
                </Table>
            </Sheet>
        </Sheet>

    );
}

export default ActionsTable;