import { SortDirection } from "ka-table";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { Row } from "../../../types";
import { createActionsChip } from "../../ConfigExplorer/ConfigurationTab";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer } from '../../ConfigExplorer/DataTable';
import { useParams } from "react-router-dom";


function actionsLinkRenderer(prop: any) {
    return createActionsChip(prop.value, 'sm', {mt: -1});
}

const columns = [{
    title: 'Action',
    property: 'step_name',
    renderer: actionsLinkRenderer,
    width: '200px'
}, {
    title: 'Status',
    property: 'status',
    renderer: cellIconRenderer,
    width: '100px'
}, {
    title: 'Attempt',
    property: 'attempt_id',
    width: '80px'
}, {
    title: 'Attempt Start',
    property: 'started_at',
    renderer: (x) => dateRenderer(x),
    width: '175px',
    visible: false
}, {
    title: 'Attempt Finish',
    property: 'finished_at',
    renderer: (x) => dateRenderer(x),
    sortDirection: SortDirection.Ascend,
    width: '175px',
    visible: false
}, {
    title: 'Prepare Start',
    property: 'details.startTstmpPrepare',
    renderer: (x) => dateRenderer(x),
    width: '175px',
    visible: false
}, {
    title: 'Prepare Finish',
    property: 'details.endTstmpPrepare',
    renderer: (x) => dateRenderer(x),
    width: '175px',
    visible: false
}, {
    title: 'Init Start',
    property: 'details.startTstmpInit',
    renderer: (x) => dateRenderer(x),
    width: '175px',
    visible: false
}, {
    title: 'Init Finish',
    property: 'details.endTstmpInit',
    renderer: (x) => dateRenderer(x),
    width: '175px',
    visible: false
}, {
    title: 'Exec Start',
    property: 'details.startTstmp',
    renderer: (x) => dateRenderer(x),
    width: '175px',
}, {
    title: 'Exec Finish',
    property: 'details.endTstmp',
    renderer: (x) => dateRenderer(x),
    width: '175px',
}, {
    title: 'Exec Duration',
    property: 'duration',
    renderer: (x) => durationRenderer(x),
    width: '150px'
}, {
    // what the action read resp. wrote, from the metrics of the state file (see metrics.ts)
    title: 'Input Count',
    property: 'mainInputCount',
    width: '150px'
}, {
    title: 'Output Count',
    property: 'mainOutputCount',
    width: '150px'
}];

export const TableView = (props: { rows: Row[], stepName?: string, setToolbarElements: (lrElements: [JSX.Element?, JSX.Element?]) => void}) => {
	const {navigateContent} = useWorkspace();
    const params = useParams();

    return <>
        <DataTable data={props.rows} columns={columns} keyAttr='step_name' name="run"
            navigate={(row) => navigateContent(`workflows/${params.flowId}/${params.runIdAttempt}/table/${row.step_name}`)} 
            setToolbarElements={(elements: JSX.Element) => props.setToolbarElements([undefined, elements])}
        />
    </>
}