import { Sheet, Table} from "@mui/joy";
import ActionRow from "./ActionRow";
import { Row } from "../../../types";

/**
 * The ActionsTables component displays the actions of a run. It is used in the ContentDrawer component.
 * It receives the rows to display as a prop.
 * @param props rows: Row[] - the rows to display
 * @returns JSX.Element
 */
const ActionsTable = (props: { rows: Row[];}) => {
    const { rows } = props;
    
    /**
     * The renderTable function renders the rows of the table. It iterates over the rows and renders an ActionRow component for each row.
     * @param rows 
     * @returns JSX.Element
     */
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
                    overflow: 'auto',
                }}
            >
                <Table size="sm" hoverRow color='neutral'>
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
                        {/** Render the rows of the table */}
                        {renderTable(rows)}
                    </tbody>
                </Table>
            </Sheet>

    );
}

export default ActionsTable;