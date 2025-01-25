import { SortDirection } from "ka-table";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { Row } from "../../../types";
import { createActionsChip } from "../../ConfigExplorer/ConfigurationTab";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer } from '../../ConfigExplorer/DataTable';


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
    property: 'startTstmpPrepare',
    renderer: (x) => dateRenderer(x),
    width: '175px',
    visible: false
}, {
    title: 'Prepare Finish',
    property: 'endTstmpPrepare',
    renderer: (x) => dateRenderer(x),
    width: '175px',
    visible: false
}, {
    title: 'Init Start',
    property: 'startTstmpInit',
    renderer: (x) => dateRenderer(x),
    width: '175px',
    visible: false
}, {
    title: 'Init Finish',
    property: 'endTstmpInit',
    renderer: (x) => dateRenderer(x),
    width: '175px',
    visible: false
}, {
    title: 'Exec Start',
    property: 'startTstmp',
    renderer: (x) => dateRenderer(x),
    width: '175px',
}, {
    title: 'Exec Finish',
    property: 'endTstmp',
    renderer: (x) => dateRenderer(x),
    width: '175px',
}, {
    title: 'Exec Duration',
    property: 'duration',
    renderer: (x) => durationRenderer(x),
    width: '150px'
}];

export const TableView = (props: { rows: Row[], stepName?: string, setToolbarElements: (lrElements: [JSX.Element?, JSX.Element?]) => void}) => {
	const {navigateRel} = useWorkspace();

    return <>
        <DataTable data={props.rows} columns={columns} keyAttr='step_name' name="run"
            navigate={(row) => navigateRel((props.stepName ? `../${row.step_name}` : `${row.step_name}`))} 
            setToolbarElements={(elements: JSX.Element) => props.setToolbarElements([undefined, elements])}
        />
    </>
}